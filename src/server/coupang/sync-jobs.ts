import { and, eq, inArray } from "drizzle-orm";
import type { DbClient } from "@/server/db/client";
import { jobs } from "@/server/db/schema";
import type { JobCheckpoint } from "@/server/jobs/runner";
import type { TenantContext } from "@/server/tenancy/context";

export const COUPANG_SYNC_JOB_TYPES = [
  "coupang.orders.collection.prepare",
  "coupang.products.collection.prepare",
  "coupang.cs.collection.prepare",
] as const;

export type CoupangSyncJobType = (typeof COUPANG_SYNC_JOB_TYPES)[number];
export type CoupangSyncKind = "orders" | "products" | "cs";
export type CoupangSyncJobStatus =
  | "queued"
  | "leased"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "dead_lettered"
  | "cancelled";

export type CoupangSyncJobSpec = {
  tenantId: string;
  type: CoupangSyncJobType;
  status: "queued";
  payloadRef: string;
  idempotencyKey: string;
  checkpoint: CoupangSyncCheckpoint;
  scheduledFor: Date;
};

export type CoupangSyncCheckpoint = JobCheckpoint & {
  provider: "coupang";
  syncKind: CoupangSyncKind;
  stage: "queued" | "ready_for_collection";
  cursor: string | null;
  preparedAt?: string;
  operatorMessage?: string;
};

export type CoupangSyncJobSummary = {
  headline: string;
  latestIssue: string | null;
  items: {
    type: CoupangSyncJobType;
    label: string;
    statusLabel: string;
    tone: "muted" | "success" | "warning" | "danger";
    updatedAt: string | null;
  }[];
};

type CoupangSyncJobRow = {
  type: string;
  status: string;
  lastError: string | null;
  updatedAt: Date | null;
};

type RunnableCoupangJob = {
  id: string;
  tenantId?: string | null;
  type: string;
  checkpoint: JobCheckpoint;
  leaseOwner: string;
};

const syncJobDefinitions: Record<
  CoupangSyncJobType,
  {
    kind: CoupangSyncKind;
    label: string;
    operatorMessage: string;
  }
> = {
  "coupang.orders.collection.prepare": {
    kind: "orders",
    label: "주문 수집",
    operatorMessage: "쿠팡 주문 수집 준비가 완료되었습니다.",
  },
  "coupang.products.collection.prepare": {
    kind: "products",
    label: "상품 확인",
    operatorMessage: "쿠팡 상품 확인 준비가 완료되었습니다.",
  },
  "coupang.cs.collection.prepare": {
    kind: "cs",
    label: "문의 확인",
    operatorMessage: "쿠팡 문의 확인 준비가 완료되었습니다.",
  },
};

export function buildCoupangInitialSyncJobSpecs(input: {
  tenantId: string;
  now?: Date;
}): CoupangSyncJobSpec[] {
  const now = input.now ?? new Date();

  return COUPANG_SYNC_JOB_TYPES.map((type) => {
    const definition = syncJobDefinitions[type];

    return {
      tenantId: input.tenantId,
      type,
      status: "queued",
      payloadRef: `coupang:${definition.kind}:collection:prepare`,
      idempotencyKey: `coupang:${definition.kind}:collection:prepare`,
      checkpoint: {
        provider: "coupang",
        syncKind: definition.kind,
        stage: "queued",
        cursor: null,
      },
      scheduledFor: now,
    };
  });
}

export async function scheduleCoupangInitialSyncJobs(input: {
  db: DbClient;
  context: TenantContext;
  now?: Date;
}): Promise<CoupangSyncJobSpec[]> {
  const now = input.now ?? new Date();
  const specs = buildCoupangInitialSyncJobSpecs({
    tenantId: input.context.tenantId,
    now,
  });

  for (const spec of specs) {
    await input.db
      .insert(jobs)
      .values({
        tenantId: spec.tenantId,
        type: spec.type,
        status: spec.status,
        payloadRef: spec.payloadRef,
        idempotencyKey: spec.idempotencyKey,
        lastError: null,
        checkpoint: spec.checkpoint,
        scheduledFor: spec.scheduledFor,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [jobs.tenantId, jobs.idempotencyKey],
        set: {
          type: spec.type,
          status: "queued",
          payloadRef: spec.payloadRef,
          lastError: null,
          checkpoint: spec.checkpoint,
          scheduledFor: spec.scheduledFor,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
  }

  return specs;
}

export async function cancelCoupangSyncJobs(input: {
  db: DbClient;
  context: TenantContext;
  now?: Date;
}): Promise<void> {
  await input.db
    .update(jobs)
    .set({
      status: "cancelled",
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: input.now ?? new Date(),
    })
    .where(
      and(
        eq(jobs.tenantId, input.context.tenantId),
        inArray(jobs.type, [...COUPANG_SYNC_JOB_TYPES]),
        inArray(jobs.status, ["queued", "retrying", "leased", "running"]),
      ),
    );
}

export async function getCoupangSyncJobSummary(input: {
  db: DbClient;
  context: TenantContext;
}): Promise<CoupangSyncJobSummary> {
  const rows = await input.db
    .select({
      type: jobs.type,
      status: jobs.status,
      lastError: jobs.lastError,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.tenantId, input.context.tenantId),
        inArray(jobs.type, [...COUPANG_SYNC_JOB_TYPES]),
      ),
    );

  return summarizeCoupangSyncJobs(rows);
}

export function summarizeCoupangSyncJobs(
  rows: readonly CoupangSyncJobRow[],
): CoupangSyncJobSummary {
  const rowByType = new Map<CoupangSyncJobType, CoupangSyncJobRow>();

  for (const row of rows) {
    if (isCoupangSyncJobType(row.type)) {
      rowByType.set(row.type, row);
    }
  }

  const items = COUPANG_SYNC_JOB_TYPES.map((type) => {
    const row = rowByType.get(type);
    const status = normalizeSyncStatus(row?.status);

    return {
      type,
      label: syncJobDefinitions[type].label,
      statusLabel: getStatusLabel(status),
      tone: getStatusTone(status),
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });

  const visibleRows = COUPANG_SYNC_JOB_TYPES.map((type) =>
    rowByType.get(type),
  ).filter((row): row is CoupangSyncJobRow => Boolean(row));
  const queuedCount = visibleRows.filter((row) => row.status === "queued").length;
  const needsAttention = visibleRows.filter((row) =>
    row.status === "retrying" || row.status === "failed" || row.status === "dead_lettered",
  );
  const succeededCount = visibleRows.filter((row) => row.status === "succeeded").length;

  if (visibleRows.length === 0) {
    return {
      headline: "쿠팡을 연결하면 시작됩니다.",
      latestIssue: null,
      items,
    };
  }

  if (needsAttention.length > 0) {
    const issue = needsAttention[0];
    const label = issue ? syncJobDefinitions[issue.type as CoupangSyncJobType].label : null;

    return {
      headline: "확인이 필요한 작업이 있습니다.",
      latestIssue: label ? `${label} 작업을 다시 시도하고 있습니다.` : null,
      items,
    };
  }

  if (queuedCount > 0) {
    return {
      headline: `${queuedCount}개 작업이 대기 중입니다.`,
      latestIssue: null,
      items,
    };
  }

  if (succeededCount === COUPANG_SYNC_JOB_TYPES.length) {
    return {
      headline: "수집 준비가 완료되었습니다.",
      latestIssue: null,
      items,
    };
  }

  return {
    headline: "동기화 상태를 확인하고 있습니다.",
    latestIssue: null,
    items,
  };
}

export async function runCoupangSyncJob(input: {
  job: RunnableCoupangJob;
  now?: Date;
}): Promise<{
  status: "succeeded";
  checkpoint: CoupangSyncCheckpoint;
  processedCount: number;
}> {
  if (!isCoupangSyncJobType(input.job.type)) {
    throw new Error(`Unsupported Coupang sync job: ${input.job.type}`);
  }

  const now = input.now ?? new Date();
  const definition = syncJobDefinitions[input.job.type];
  const checkpoint = normalizeCoupangCheckpoint(input.job.checkpoint, definition.kind);

  return {
    status: "succeeded",
    processedCount: 0,
    checkpoint: {
      ...checkpoint,
      stage: "ready_for_collection",
      preparedAt: now.toISOString(),
      operatorMessage: definition.operatorMessage,
    },
  };
}

export function isCoupangSyncJobType(type: string): type is CoupangSyncJobType {
  return COUPANG_SYNC_JOB_TYPES.includes(type as CoupangSyncJobType);
}

function normalizeCoupangCheckpoint(
  value: JobCheckpoint,
  syncKind: CoupangSyncKind,
): CoupangSyncCheckpoint {
  return {
    provider: "coupang",
    syncKind,
    stage: "queued",
    cursor:
      typeof value.cursor === "string"
        ? value.cursor
        : null,
  };
}

function normalizeSyncStatus(status: string | undefined): CoupangSyncJobStatus | "empty" {
  if (
    status === "queued" ||
    status === "leased" ||
    status === "running" ||
    status === "succeeded" ||
    status === "failed" ||
    status === "retrying" ||
    status === "dead_lettered" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "empty";
}

function getStatusLabel(status: CoupangSyncJobStatus | "empty"): string {
  if (status === "queued") {
    return "대기 중";
  }

  if (status === "leased" || status === "running") {
    return "진행 중";
  }

  if (status === "succeeded") {
    return "준비 완료";
  }

  if (status === "retrying") {
    return "다시 시도 중";
  }

  if (status === "failed" || status === "dead_lettered") {
    return "확인 필요";
  }

  if (status === "cancelled") {
    return "중지됨";
  }

  return "연동 후 시작";
}

function getStatusTone(
  status: CoupangSyncJobStatus | "empty",
): CoupangSyncJobSummary["items"][number]["tone"] {
  if (status === "succeeded") {
    return "success";
  }

  if (status === "retrying" || status === "queued" || status === "leased" || status === "running") {
    return "warning";
  }

  if (status === "failed" || status === "dead_lettered") {
    return "danger";
  }

  return "muted";
}
