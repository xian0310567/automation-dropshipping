import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  COUPANG_MAX_REQUESTS_PER_SECOND,
  CoupangApiError,
  requestCoupangJson,
  type CoupangFetch,
  type CoupangRequestLog,
} from "@/server/coupang/coupang-client";
import type { DbClient } from "@/server/db/client";
import {
  alerts,
  apiRequestLogs,
  orders,
  products,
} from "@/server/db/schema";
import type { ServerEnv } from "@/server/env-core";
import { getStoredCoupangCredentials } from "@/server/integrations/coupang-credentials";
import type { JobCheckpoint } from "@/server/jobs/runner";
import { runBoundedJob } from "@/server/jobs/runner";
import { encryptCredentialPayload } from "@/server/security/envelope";

export type CoupangCollectionKind = "orders" | "products" | "cs";

export type CoupangCollectionCheckpoint = JobCheckpoint & {
  provider: "coupang";
  syncKind: CoupangCollectionKind;
  stage: "queued" | "collecting" | "collected" | "idle";
  cursor: Record<string, unknown> | null;
  collectedAt?: string;
  windowEnd?: string;
  windowStart?: string;
};

type CollectionJob = {
  checkpoint: JobCheckpoint;
  id: string;
  tenantId?: string | null;
  type: string;
};

type RunnerEnv = Pick<ServerEnv, "COUPANG_MARKET" | "PII_ENCRYPTION_KEY">;

export type CoupangCollectionRunnerDeps = {
  db: DbClient;
  env: RunnerEnv;
  fetchImpl?: CoupangFetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

type CoupangListResponse<TData> = {
  code?: number | string;
  data?: TData;
  message?: string;
  nextToken?: string | null;
};

type CoupangOrderSheet = {
  orderId?: number | string;
  shipmentBoxId?: number | string | null;
  orderedAt?: string | null;
  paidAt?: string | null;
  status?: string | null;
  orderer?: {
    name?: string | null;
  } | null;
  receiver?: Record<string, unknown> | null;
  orderItems?: CoupangOrderItem[];
};

type CoupangOrderItem = {
  externalVendorSkuCode?: string | null;
  productId?: number | string | null;
  sellerProductId?: number | string | null;
  sellerProductItemName?: string | null;
  sellerProductName?: string | null;
  vendorItemId?: number | string | null;
  vendorItemName?: string | null;
};

type CoupangProductResponse = {
  code?: string;
  data?: {
    displayProductName?: string | null;
    items?: CoupangProductItem[];
    sellerProductId?: number | string | null;
    sellerProductName?: string | null;
    statusName?: string | null;
  };
  message?: string;
};

type CoupangProductItem = {
  externalVendorSkuCode?: string | null;
  itemName?: string | null;
  vendorItemId?: number | string | null;
  vendorItemName?: string | null;
};

type CoupangInquiry = {
  inquiryId?: number | string;
  inquiryStatus?: string | null;
  orderId?: number | string | null;
  partnerCounselingStatus?: string | null;
  csPartnerCounselingStatus?: string | null;
  title?: string | null;
  vendorItemId?: number | string | null;
};

type CoupangInquiryListData =
  | CoupangInquiry[]
  | {
      content?: CoupangInquiry[];
    };

const ORDER_STATUSES = [
  "ACCEPT",
  "INSTRUCT",
  "DEPARTURE",
  "DELIVERING",
  "FINAL_DELIVERY",
  "NONE_TRACKING",
] as const;

const CS_STATUSES = ["NO_ANSWER", "TRANSFER"] as const;
const ORDER_WINDOW_MS = 23 * 60 * 60 * 1000 + 55 * 60 * 1000;
const PRODUCT_BATCH_SIZE = 10;

export async function runCoupangCollectionJob(input: {
  deps: CoupangCollectionRunnerDeps;
  job: CollectionJob;
}) {
  const tenantId = requireTenantId(input.job);
  const checkpoint = normalizeCollectionCheckpoint(input.job.checkpoint);
  const credentials = await getStoredCoupangCredentials({
    db: input.deps.db,
    context: { tenantId },
    env: input.deps.env,
  });
  const request = createLoggedCoupangRequest({
    db: input.deps.db,
    env: input.deps.env,
    fetchImpl: input.deps.fetchImpl,
    integrationAccountId: credentials.accountId,
    market: input.deps.env.COUPANG_MARKET || "KR",
    now: input.deps.now,
    sleep: input.deps.sleep,
    tenantId,
  });

  return runBoundedJob({
    checkpoint,
    now: input.deps.now,
    handler: async ({ checkpoint: current }) => {
      const currentCheckpoint = normalizeCollectionCheckpoint(current);

      if (currentCheckpoint.syncKind === "orders") {
        return collectOrderStep({
          checkpoint: currentCheckpoint,
          credentials,
          env: input.deps.env,
          now: input.deps.now?.() ?? new Date(),
          request,
          tenantId,
          db: input.deps.db,
        });
      }

      if (currentCheckpoint.syncKind === "products") {
        return collectProductStep({
          checkpoint: currentCheckpoint,
          credentials,
          now: input.deps.now?.() ?? new Date(),
          request,
          tenantId,
          db: input.deps.db,
        });
      }

      return collectCsStep({
        checkpoint: currentCheckpoint,
        credentials,
        now: input.deps.now?.() ?? new Date(),
        request,
        tenantId,
        db: input.deps.db,
      });
    },
  });
}

function createLoggedCoupangRequest(input: {
  db: DbClient;
  env: RunnerEnv;
  fetchImpl?: CoupangFetch;
  integrationAccountId: string;
  market: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  tenantId: string;
}) {
  const waitForRequestSlot = createCoupangRequestLimiter({
    now: input.now,
    sleep: input.sleep,
  });

  return async <TResponse>(request: {
    credentials: {
      accessKey: string;
      secretKey: string;
      vendorId: string;
    };
    path: string;
    query?: Record<string, string | number | null | undefined>;
  }): Promise<TResponse> => {
    await waitForRequestSlot();

    try {
      const result = await requestCoupangJson<TResponse>({
        credentials: request.credentials,
        fetchImpl: input.fetchImpl,
        market: input.market,
        now: input.now,
        path: request.path,
        query: request.query,
      });

      await recordCoupangRequestLog({
        db: input.db,
        integrationAccountId: input.integrationAccountId,
        log: result.log,
        tenantId: input.tenantId,
      });

      return result.body;
    } catch (error) {
      if (error instanceof CoupangApiError && error.log) {
        await recordCoupangRequestLog({
          db: input.db,
          errorMessage: error.message,
          integrationAccountId: input.integrationAccountId,
          log: error.log,
          tenantId: input.tenantId,
        });
      }

      throw error;
    }
  };
}

function createCoupangRequestLimiter(input: {
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}) {
  const spacingMs = Math.ceil(1000 / COUPANG_MAX_REQUESTS_PER_SECOND);
  const now = input.now ?? (() => new Date());
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let nextAvailableAt = 0;

  return async () => {
    const currentTime = now().getTime();

    if (nextAvailableAt > currentTime) {
      await sleep(nextAvailableAt - currentTime);
    }

    nextAvailableAt = Math.max(currentTime, nextAvailableAt) + spacingMs;
  };
}

async function collectOrderStep(input: {
  checkpoint: CoupangCollectionCheckpoint;
  credentials: {
    accessKey: string;
    secretKey: string;
    vendorId: string;
  };
  db: DbClient;
  env: RunnerEnv;
  now: Date;
  request: <TResponse>(request: {
    credentials: {
      accessKey: string;
      secretKey: string;
      vendorId: string;
    };
    path: string;
    query?: Record<string, string | number | null | undefined>;
  }) => Promise<TResponse>;
  tenantId: string;
}) {
  const cursor = normalizeOrderCursor(input.checkpoint.cursor);
  const windowStart =
    input.checkpoint.windowStart ??
    formatIsoWithKstOffset(new Date(input.now.getTime() - ORDER_WINDOW_MS));
  const windowEnd =
    input.checkpoint.windowEnd ?? formatIsoWithKstOffset(input.now);
  const status = ORDER_STATUSES[cursor.statusIndex] ?? ORDER_STATUSES[0];
  const response = await input.request<CoupangListResponse<CoupangOrderSheet[]>>({
    credentials: input.credentials,
    path: `/v2/providers/openapi/apis/api/v5/vendors/${input.credentials.vendorId}/ordersheets`,
    query: {
      createdAtFrom: windowStart,
      createdAtTo: windowEnd,
      nextToken: cursor.nextToken,
      searchType: "timeFrame",
      status,
    },
  });
  const orderSheets = Array.isArray(response.data) ? response.data : [];
  const processedCount = await persistCoupangOrders({
    db: input.db,
    env: input.env,
    now: input.now,
    orderSheets,
    tenantId: input.tenantId,
  });

  if (response.nextToken) {
    return {
      checkpoint: {
        ...input.checkpoint,
        cursor: {
          nextToken: response.nextToken,
          statusIndex: cursor.statusIndex,
        },
        stage: "collecting",
        windowEnd,
        windowStart,
      },
      done: false,
      processedCount,
    };
  }

  const nextStatusIndex = cursor.statusIndex + 1;

  if (nextStatusIndex < ORDER_STATUSES.length) {
    return {
      checkpoint: {
        ...input.checkpoint,
        cursor: {
          nextToken: null,
          statusIndex: nextStatusIndex,
        },
        stage: "collecting",
        windowEnd,
        windowStart,
      },
      done: false,
      processedCount,
    };
  }

  return {
    checkpoint: {
      ...input.checkpoint,
      collectedAt: input.now.toISOString(),
      cursor: null,
      stage: "collected",
      windowEnd,
      windowStart,
    },
    done: true,
    processedCount,
  };
}

async function collectProductStep(input: {
  checkpoint: CoupangCollectionCheckpoint;
  credentials: {
    accessKey: string;
    secretKey: string;
    vendorId: string;
  };
  db: DbClient;
  now: Date;
  request: <TResponse>(request: {
    credentials: {
      accessKey: string;
      secretKey: string;
      vendorId: string;
    };
    path: string;
  }) => Promise<TResponse>;
  tenantId: string;
}) {
  const productRows = await input.db
    .select({
      sellerProductId: products.sellerProductId,
    })
    .from(products)
    .where(eq(products.tenantId, input.tenantId))
    .orderBy(asc(products.updatedAt))
    .limit(PRODUCT_BATCH_SIZE);

  if (productRows.length === 0) {
    return {
      checkpoint: {
        ...input.checkpoint,
        collectedAt: input.now.toISOString(),
        cursor: null,
        stage: "idle",
      },
      done: true,
      processedCount: 0,
    };
  }

  let processedCount = 0;

  for (const row of productRows) {
    const response = await input.request<CoupangProductResponse>({
      credentials: input.credentials,
      path: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${row.sellerProductId}`,
    });

    processedCount += await persistCoupangProduct({
      db: input.db,
      now: input.now,
      product: response.data,
      tenantId: input.tenantId,
    });
  }

  return {
    checkpoint: {
      ...input.checkpoint,
      collectedAt: input.now.toISOString(),
      cursor: null,
      stage: "collected",
    },
    done: true,
    processedCount,
  };
}

async function collectCsStep(input: {
  checkpoint: CoupangCollectionCheckpoint;
  credentials: {
    accessKey: string;
    secretKey: string;
    vendorId: string;
  };
  db: DbClient;
  now: Date;
  request: <TResponse>(request: {
    credentials: {
      accessKey: string;
      secretKey: string;
      vendorId: string;
    };
    path: string;
    query?: Record<string, string | number | null | undefined>;
  }) => Promise<TResponse>;
  tenantId: string;
}) {
  const cursor = normalizeCsCursor(input.checkpoint.cursor);
  const inquiryStartAt =
    input.checkpoint.windowStart ?? formatKstDate(new Date(input.now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const inquiryEndAt = input.checkpoint.windowEnd ?? formatKstDate(input.now);
  const status = CS_STATUSES[cursor.statusIndex] ?? CS_STATUSES[0];
  const response = await input.request<CoupangListResponse<CoupangInquiryListData>>({
    credentials: input.credentials,
    path: `/v2/providers/openapi/apis/api/v5/vendors/${input.credentials.vendorId}/callCenterInquiries`,
    query: {
      inquiryEndAt,
      inquiryStartAt,
      pageNum: cursor.pageNum,
      pageSize: 30,
      partnerCounselingStatus: status,
      vendorId: input.credentials.vendorId,
    },
  });
  const inquiries = extractCoupangInquiries(response.data);
  const processedCount = await persistCoupangInquiries({
    db: input.db,
    inquiries,
    status,
    tenantId: input.tenantId,
  });
  const hasNextPage = inquiries.length === 30;

  if (hasNextPage) {
    return {
      checkpoint: {
        ...input.checkpoint,
        cursor: {
          pageNum: cursor.pageNum + 1,
          statusIndex: cursor.statusIndex,
        },
        stage: "collecting",
        windowEnd: inquiryEndAt,
        windowStart: inquiryStartAt,
      },
      done: false,
      processedCount,
    };
  }

  const nextStatusIndex = cursor.statusIndex + 1;

  if (nextStatusIndex < CS_STATUSES.length) {
    return {
      checkpoint: {
        ...input.checkpoint,
        cursor: {
          pageNum: 1,
          statusIndex: nextStatusIndex,
        },
        stage: "collecting",
        windowEnd: inquiryEndAt,
        windowStart: inquiryStartAt,
      },
      done: false,
      processedCount,
    };
  }

  return {
    checkpoint: {
      ...input.checkpoint,
      collectedAt: input.now.toISOString(),
      cursor: null,
      stage: "collected",
      windowEnd: inquiryEndAt,
      windowStart: inquiryStartAt,
    },
    done: true,
    processedCount,
  };
}

async function persistCoupangOrders(input: {
  db: DbClient;
  env: RunnerEnv;
  now: Date;
  orderSheets: CoupangOrderSheet[];
  tenantId: string;
}): Promise<number> {
  let processedCount = 0;

  for (const orderSheet of input.orderSheets) {
    const orderId = stringifyId(orderSheet.orderId);

    if (!orderId) {
      continue;
    }

    const firstItem = orderSheet.orderItems?.find((item) => stringifyId(item.vendorItemId));
    const receiverInfoEncrypted = orderSheet.receiver
      ? encryptCredentialPayload(
          orderSheet.receiver,
          {
            provider: "coupang:receiver",
            tenantId: input.tenantId,
          },
          input.env,
        )
      : null;
    const orderedAt = parseOptionalDate(orderSheet.orderedAt ?? orderSheet.paidAt);

    await input.db
      .insert(orders)
      .values({
        tenantId: input.tenantId,
        orderId,
        shipmentBoxId: stringifyId(orderSheet.shipmentBoxId),
        vendorItemId: stringifyId(firstItem?.vendorItemId),
        orderStatus: orderSheet.status ?? "UNKNOWN",
        buyerNameMasked: orderSheet.orderer?.name ?? null,
        receiverInfoEncrypted,
        shippingAddressHash: orderSheet.receiver
          ? hashStableJson(orderSheet.receiver)
          : null,
        fulfillmentStatus: mapFulfillmentStatus(orderSheet.status),
        rawPayloadRef: `coupang:order:${hashStableJson({ orderId })}`,
        orderedAt,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: [orders.tenantId, orders.orderId],
        set: {
          shipmentBoxId: stringifyId(orderSheet.shipmentBoxId),
          vendorItemId: stringifyId(firstItem?.vendorItemId),
          orderStatus: orderSheet.status ?? "UNKNOWN",
          buyerNameMasked: orderSheet.orderer?.name ?? null,
          receiverInfoEncrypted,
          shippingAddressHash: orderSheet.receiver
            ? hashStableJson(orderSheet.receiver)
            : null,
          fulfillmentStatus: mapFulfillmentStatus(orderSheet.status),
          rawPayloadRef: `coupang:order:${hashStableJson({ orderId })}`,
          orderedAt,
          updatedAt: input.now,
        },
      });

    for (const item of orderSheet.orderItems ?? []) {
      await persistCoupangProduct({
        db: input.db,
        lastOrderAt: orderedAt,
        now: input.now,
        product: productFromOrderItem(item, orderSheet.status),
        tenantId: input.tenantId,
      });
    }

    processedCount += 1;
  }

  return processedCount;
}

async function persistCoupangProduct(input: {
  db: DbClient;
  lastOrderAt?: Date | null;
  now: Date;
  product?: CoupangProductResponse["data"] | null;
  tenantId: string;
}): Promise<number> {
  const product = input.product;
  const sellerProductId = stringifyId(product?.sellerProductId);

  if (!product || !sellerProductId) {
    return 0;
  }

  const items = product.items?.length
    ? product.items
    : [{ vendorItemId: null, vendorItemName: null, itemName: null }];
  let processedCount = 0;

  for (const item of items) {
    const vendorItemId = stringifyId(item.vendorItemId) ?? sellerProductId;

    await input.db
      .insert(products)
      .values({
        tenantId: input.tenantId,
        sellerProductId,
        vendorItemId,
        externalVendorSku: item.externalVendorSkuCode ?? null,
        productName:
          item.vendorItemName ??
          item.itemName ??
          product.displayProductName ??
          product.sellerProductName ??
          "쿠팡 상품",
        status: product.statusName ?? "unknown",
        lastOrderAt: input.lastOrderAt ?? null,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: [products.tenantId, products.vendorItemId],
        set: {
          sellerProductId,
          externalVendorSku: item.externalVendorSkuCode ?? null,
          productName:
            item.vendorItemName ??
            item.itemName ??
            product.displayProductName ??
            product.sellerProductName ??
            "쿠팡 상품",
          status: product.statusName ?? "unknown",
          lastOrderAt: input.lastOrderAt ?? undefined,
          updatedAt: input.now,
        },
      });
    processedCount += 1;
  }

  return processedCount;
}

async function persistCoupangInquiries(input: {
  db: DbClient;
  inquiries: CoupangInquiry[];
  status: string;
  tenantId: string;
}): Promise<number> {
  const inquiryIds = input.inquiries
    .map((inquiry) => stringifyId(inquiry.inquiryId))
    .filter((inquiryId): inquiryId is string => Boolean(inquiryId));

  if (inquiryIds.length === 0) {
    return 0;
  }

  const existing = await input.db
    .select({
      relatedOrderId: alerts.relatedOrderId,
    })
    .from(alerts)
    .where(
      and(
        eq(alerts.tenantId, input.tenantId),
        eq(alerts.type, "coupang_cs_inquiry"),
        inArray(alerts.relatedOrderId, inquiryIds),
      ),
    );
  const existingIds = new Set(existing.map((row) => row.relatedOrderId));
  let processedCount = 0;

  for (const inquiry of input.inquiries) {
    const inquiryId = stringifyId(inquiry.inquiryId);

    if (!inquiryId || existingIds.has(inquiryId)) {
      continue;
    }

    const title = inquiry.title ? ` · ${inquiry.title}` : "";

    await input.db.insert(alerts).values({
      tenantId: input.tenantId,
      type: "coupang_cs_inquiry",
      severity: input.status === "NO_ANSWER" ? "critical" : "warning",
      message: `쿠팡 문의 ${inquiryId} 확인 필요 (${input.status})${title}`,
      relatedOrderId: inquiryId,
      relatedProductId: stringifyId(inquiry.vendorItemId),
      resolved: false,
    });
    processedCount += 1;
  }

  return processedCount;
}

async function recordCoupangRequestLog(input: {
  db: DbClient;
  errorMessage?: string;
  integrationAccountId: string;
  log: CoupangRequestLog;
  tenantId: string;
}) {
  await input.db
    .insert(apiRequestLogs)
    .values({
      tenantId: input.tenantId,
      integrationAccountId: input.integrationAccountId,
      provider: "coupang",
      requestHash: input.log.requestHash,
      statusCode: input.log.statusCode,
      durationMs: input.log.durationMs,
      rateLimitBucket: input.log.statusCode === 429 ? "limited" : "standard",
      redactedRequest: {
        method: input.log.method,
        path: stripQuery(input.log.pathWithQuery),
        queryKeys: getQueryKeys(input.log.pathWithQuery),
      },
      redactedResponse: input.log.responseSummary,
      redactedError: input.errorMessage?.slice(0, 240) ?? null,
    })
    .onConflictDoNothing({
      target: apiRequestLogs.requestHash,
    });
}

function normalizeCollectionCheckpoint(
  checkpoint: JobCheckpoint,
): CoupangCollectionCheckpoint {
  if (
    checkpoint.provider === "coupang" &&
    (checkpoint.syncKind === "orders" ||
      checkpoint.syncKind === "products" ||
      checkpoint.syncKind === "cs")
  ) {
    return {
      ...checkpoint,
      cursor:
        checkpoint.cursor && typeof checkpoint.cursor === "object"
          ? (checkpoint.cursor as Record<string, unknown>)
          : null,
      provider: "coupang",
      stage:
        checkpoint.stage === "collecting" ||
        checkpoint.stage === "collected" ||
        checkpoint.stage === "idle"
          ? checkpoint.stage
          : "queued",
      syncKind: checkpoint.syncKind,
    };
  }

  throw new Error("Invalid Coupang collection checkpoint");
}

function extractCoupangInquiries(
  data: CoupangInquiryListData | undefined,
): CoupangInquiry[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.content)) {
    return data.content;
  }

  return [];
}

function normalizeOrderCursor(cursor: Record<string, unknown> | null) {
  return {
    nextToken: typeof cursor?.nextToken === "string" ? cursor.nextToken : null,
    statusIndex: normalizeIndex(cursor?.statusIndex, ORDER_STATUSES.length),
  };
}

function normalizeCsCursor(cursor: Record<string, unknown> | null) {
  return {
    pageNum: Math.max(1, normalizeNumber(cursor?.pageNum, 1)),
    statusIndex: normalizeIndex(cursor?.statusIndex, CS_STATUSES.length),
  };
}

function normalizeIndex(value: unknown, size: number): number {
  const index = normalizeNumber(value, 0);

  return index >= 0 && index < size ? index : 0;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function requireTenantId(job: CollectionJob): string {
  if (!job.tenantId) {
    throw new Error("Coupang collection jobs require tenantId");
  }

  return job.tenantId;
}

function productFromOrderItem(
  item: CoupangOrderItem,
  orderStatus: string | null | undefined,
): CoupangProductResponse["data"] {
  return {
    displayProductName: item.vendorItemName ?? item.sellerProductName ?? null,
    items: [
      {
        externalVendorSkuCode: item.externalVendorSkuCode ?? null,
        itemName: item.sellerProductItemName ?? item.vendorItemName ?? null,
        vendorItemId: item.vendorItemId ?? null,
        vendorItemName: item.vendorItemName ?? item.sellerProductItemName ?? null,
      },
    ],
    sellerProductId: item.sellerProductId ?? item.productId ?? null,
    sellerProductName: item.sellerProductName ?? null,
    statusName: orderStatus ?? "ordered",
  };
}

function mapFulfillmentStatus(status: string | null | undefined): string {
  if (status === "ACCEPT") {
    return "payment_completed";
  }

  if (status === "INSTRUCT") {
    return "preparing";
  }

  if (status === "DEPARTURE" || status === "DELIVERING") {
    return "shipping";
  }

  if (status === "FINAL_DELIVERY") {
    return "delivered";
  }

  if (status === "NONE_TRACKING") {
    return "seller_direct";
  }

  return "pending";
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoWithKstOffset(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}+09:00`;
}

function formatKstDate(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function hashStableJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stripQuery(pathWithQuery: string): string {
  return pathWithQuery.split("?")[0] ?? pathWithQuery;
}

function getQueryKeys(pathWithQuery: string): string[] {
  const [, query] = pathWithQuery.split("?");

  if (!query) {
    return [];
  }

  return [...new URLSearchParams(query).keys()].sort();
}
