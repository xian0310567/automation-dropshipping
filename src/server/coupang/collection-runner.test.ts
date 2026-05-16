import { describe, expect, it } from "vitest";
import { runCoupangCollectionJob } from "./collection-runner";
import type { CoupangFetch } from "./coupang-client";
import type { DbClient } from "@/server/db/client";
import {
  alerts,
  apiRequestLogs,
  orders,
  products,
} from "@/server/db/schema";
import { encryptCredentialPayload } from "@/server/security/envelope";

describe("runCoupangCollectionJob", () => {
  it("collects signed Coupang orders into tenant storage with redacted request logs", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const now = new Date("2026-05-16T07:15:00.000Z");
    const account = {
      id: "22222222-2222-4222-8222-222222222222",
      status: "connected",
      credentialEncryptedPayload: encryptCredentialPayload(
        {
          accessKey: "test-access-key",
          secretKey: "test-secret-key",
          vendorId: "A00123456",
        },
        {
          provider: "coupang",
          tenantId,
        },
        { PII_ENCRYPTION_KEY: "test-encryption-key" },
      ),
    };
    const { db, inserts } = createCollectionDbDouble(account);
    const requestedUrls: string[] = [];
    const waitDurations: number[] = [];
    const fetchImpl: CoupangFetch = async (url, init) => {
      requestedUrls.push(url);
      expect(init.headers.Authorization).toContain("CEA algorithm=HmacSHA256");
      expect(init.headers["X-Requested-By"]).toBe("A00123456");

      const isAcceptWindow = url.includes("status=ACCEPT");

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            code: 200,
            message: "OK",
            data: isAcceptWindow
              ? [
                  {
                    orderId: 1234567890,
                    shipmentBoxId: "box-1",
                    orderedAt: "2026-05-16T15:00:00+09:00",
                    status: "ACCEPT",
                    orderer: { name: "김테스트" },
                    receiver: {
                      name: "홍길동",
                      addr1: "서울시 테스트구",
                      phone: "01012345678",
                    },
                    orderItems: [
                      {
                        externalVendorSkuCode: "OC-1000",
                        sellerProductId: 98765,
                        sellerProductName: "테스트 상품",
                        vendorItemId: 54321,
                        vendorItemName: "테스트 상품 화이트",
                      },
                    ],
                  },
                ]
              : [],
          }),
      };
    };

    const result = await runCoupangCollectionJob({
      deps: {
        db,
        env: {
          COUPANG_MARKET: "KR",
          PII_ENCRYPTION_KEY: "test-encryption-key",
        },
        fetchImpl,
        now: () => now,
        sleep: async (ms) => {
          waitDurations.push(ms);
        },
      },
      job: {
        id: "job-1",
        tenantId,
        type: "coupang.orders.collect",
        checkpoint: {
          provider: "coupang",
          syncKind: "orders",
          stage: "queued",
          cursor: null,
        },
      },
    });

    expect(result).toMatchObject({
      status: "succeeded",
      processedCount: 1,
      checkpoint: {
        provider: "coupang",
        syncKind: "orders",
        stage: "collected",
      },
    });
    expect(requestedUrls).toHaveLength(6);
    expect(waitDurations).toHaveLength(5);
    expect(waitDurations.every((duration) => duration > 0)).toBe(true);
    expect(requestedUrls[0]).toContain("/ordersheets?");
    expect(requestedUrls[0]).toContain("createdAtFrom=");
    expect(requestedUrls[0]).toContain("createdAtTo=");
    expect(requestedUrls[0]).toContain("searchType=timeFrame");

    const orderWrites = inserts.filter((entry) => entry.table === orders);
    const productWrites = inserts.filter((entry) => entry.table === products);
    const apiLogs = inserts.filter((entry) => entry.table === apiRequestLogs);

    expect(orderWrites).toHaveLength(1);
    expect(productWrites).toHaveLength(1);
    expect(apiLogs).toHaveLength(6);
    expect(orderWrites[0]?.values).toMatchObject({
      tenantId,
      orderId: "1234567890",
      orderStatus: "ACCEPT",
      fulfillmentStatus: "payment_completed",
      shippingAddressHash: expect.any(String),
    });
    expect(String(orderWrites[0]?.values.receiverInfoEncrypted)).not.toContain(
      "홍길동",
    );
    expect(JSON.stringify(apiLogs.map((entry) => entry.values))).not.toContain(
      "서울시 테스트구",
    );
  });

  it("refreshes known Coupang products through the live product endpoint", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const now = new Date("2026-05-16T07:15:00.000Z");
    const account = {
      id: "22222222-2222-4222-8222-222222222222",
      status: "connected",
      credentialEncryptedPayload: encryptCredentialPayload(
        {
          accessKey: "test-access-key",
          secretKey: "test-secret-key",
          vendorId: "A00123456",
        },
        {
          provider: "coupang",
          tenantId,
        },
        { PII_ENCRYPTION_KEY: "test-encryption-key" },
      ),
    };
    const { db, inserts } = createCollectionDbDouble(account, {
      productRows: [{ sellerProductId: "98765" }],
    });
    const requestedUrls: string[] = [];
    const fetchImpl: CoupangFetch = async (url) => {
      requestedUrls.push(url);

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            code: "SUCCESS",
            message: "",
            data: {
              displayProductName: "테스트 상품",
              sellerProductId: 98765,
              sellerProductName: "테스트 상품",
              statusName: "승인완료",
              items: [
                {
                  externalVendorSkuCode: "OC-1000",
                  itemName: "화이트",
                  vendorItemId: 54321,
                  vendorItemName: "테스트 상품 화이트",
                },
              ],
            },
          }),
      };
    };

    const result = await runCoupangCollectionJob({
      deps: {
        db,
        env: {
          COUPANG_MARKET: "KR",
          PII_ENCRYPTION_KEY: "test-encryption-key",
        },
        fetchImpl,
        now: () => now,
        sleep: async () => undefined,
      },
      job: {
        id: "job-1",
        tenantId,
        type: "coupang.products.collect",
        checkpoint: {
          provider: "coupang",
          syncKind: "products",
          stage: "queued",
          cursor: null,
        },
      },
    });

    expect(result).toMatchObject({
      status: "succeeded",
      processedCount: 1,
      checkpoint: {
        provider: "coupang",
        syncKind: "products",
        stage: "collected",
      },
    });
    expect(requestedUrls).toEqual([
      "https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/98765",
    ]);
    expect(
      inserts.filter((entry) => entry.table === products).at(-1)?.values,
    ).toMatchObject({
      tenantId,
      sellerProductId: "98765",
      vendorItemId: "54321",
      status: "승인완료",
    });
  });

  it("turns Coupang contact-center inquiries into actionable tenant alerts", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const now = new Date("2026-05-16T07:15:00.000Z");
    const account = {
      id: "22222222-2222-4222-8222-222222222222",
      status: "connected",
      credentialEncryptedPayload: encryptCredentialPayload(
        {
          accessKey: "test-access-key",
          secretKey: "test-secret-key",
          vendorId: "A00123456",
        },
        {
          provider: "coupang",
          tenantId,
        },
        { PII_ENCRYPTION_KEY: "test-encryption-key" },
      ),
    };
    const { db, inserts } = createCollectionDbDouble(account);
    const requestedUrls: string[] = [];
    const fetchImpl: CoupangFetch = async (url) => {
      requestedUrls.push(url);
      const hasUnansweredStatus = url.includes("partnerCounselingStatus=NO_ANSWER");

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            code: 200,
            message: "OK",
            data: {
              content: hasUnansweredStatus
                ? [
                    {
                      inquiryId: 7001,
                      partnerCounselingStatus: "NO_ANSWER",
                      title: "배송 시작일 문의",
                      vendorItemId: 54321,
                    },
                  ]
                : [],
            },
          }),
      };
    };

    const result = await runCoupangCollectionJob({
      deps: {
        db,
        env: {
          COUPANG_MARKET: "KR",
          PII_ENCRYPTION_KEY: "test-encryption-key",
        },
        fetchImpl,
        now: () => now,
        sleep: async () => undefined,
      },
      job: {
        id: "job-1",
        tenantId,
        type: "coupang.cs.collect",
        checkpoint: {
          provider: "coupang",
          syncKind: "cs",
          stage: "queued",
          cursor: null,
        },
      },
    });

    expect(result).toMatchObject({
      status: "succeeded",
      processedCount: 1,
      checkpoint: {
        provider: "coupang",
        syncKind: "cs",
        stage: "collected",
      },
    });
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("/callCenterInquiries?");
    expect(requestedUrls[0]).toContain("pageSize=30");
    expect(requestedUrls[0]).toContain("inquiryStartAt=2026-05-10");
    expect(requestedUrls[0]).toContain("inquiryEndAt=2026-05-16");

    const alertWrites = inserts.filter((entry) => entry.table === alerts);
    const apiLogs = inserts.filter((entry) => entry.table === apiRequestLogs);

    expect(alertWrites).toHaveLength(1);
    expect(apiLogs).toHaveLength(2);
    expect(alertWrites[0]?.values).toMatchObject({
      tenantId,
      type: "coupang_cs_inquiry",
      severity: "critical",
      relatedOrderId: "7001",
      relatedProductId: "54321",
      resolved: false,
    });
    expect(String(alertWrites[0]?.values.message)).toContain("배송 시작일 문의");
  });
});

type InsertRecord = {
  table: unknown;
  values: Record<string, unknown>;
};

function createCollectionDbDouble(
  account: Record<string, unknown>,
  options: {
    existingAlerts?: { relatedOrderId: string | null }[];
    productRows?: { sellerProductId: string }[];
  } = {},
) {
  const inserts: InsertRecord[] = [];
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table !== alerts && table !== products) {
            return {
              limit: async () => [account],
            };
          }

          if (table === products) {
            return {
              orderBy: () => ({
                limit: async () => options.productRows ?? [],
              }),
            };
          }

          return options.existingAlerts ?? [];
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table, values });

        return {
          onConflictDoNothing: async () => undefined,
          onConflictDoUpdate: async () => undefined,
        };
      },
    }),
  };

  return {
    db: db as unknown as DbClient,
    inserts,
  };
}
