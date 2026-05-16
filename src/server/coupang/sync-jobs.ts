import { and, eq, inArray } from "drizzle-orm";
import { CoupangApiError, type CoupangFetch } from "@/server/coupang/coupang-client";
import {
  runCoupangCollectionJob,
  type CoupangCollectionCheckpoint,
} from "@/server/coupang/collection-runner";
import type { DbClient } from "@/server/db/client";
import { jobs } from "@/server/db/schema";
import type { ServerEnv } from "@/server/env-core";
import type { JobCheckpoint } from "@/server/jobs/runner";
import type { TenantContext } from "@/server/tenancy/context";

export const COUPANG_SYNC_JOB_TYPES = [
  "coupang.orders.collect",
  "coupang.products.collect",
  "coupang.cs.collect",
] as const;
export const COUPANG_COLLECTION_INTERVAL_MS_BY_TYPE: Record<
  (typeof COUPANG_SYNC_JOB_TYPES)[number],
  number
> = {
  "coupang.orders.collect": 10 * 60 * 1000,
  "coupang.products.collect": 60 * 60 * 1000,
  "coupang.cs.collect": 10 * 60 * 1000,
};
export const COUPANG_DEFAULT_FAILURE_BACKOFF_MS = 60 * 1000;
export const COUPANG_MAX_FAILURE_BACKOFF_MS = 15 * 60 * 1000;
export const COUPANG_LEGACY_SYNC_JOB_TYPES = [
  "coupang.orders.collection.prepare",
  "coupang.products.collection.prepare",
  "coupang.cs.collection.prepare",
] as const;
export const ALL_COUPANG_SYNC_JOB_TYPES = [
  ...COUPANG_SYNC_JOB_TYPES,
  ...COUPANG_LEGACY_SYNC_JOB_TYPES,
] as const;

export type CoupangSyncJobType = (typeof ALL_COUPANG_SYNC_JOB_TYPES)[number];
export type CurrentCoupangSyncJobType = (typeof COUPANG_SYNC_JOB_TYPES)[number];
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
  type: CurrentCoupangSyncJobType;
  status: "queued";
  payloadRef: string;
  idempotencyKey: string;
  checkpoint: CoupangCollectionCheckpoint;
  scheduledFor: Date;
};

export type CoupangSyncJobSummary = {
  headline: string;
  latestIssue: string | null;
  items: {
    type: CurrentCoupangSyncJobType;
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
  leaseExpiresAt?: Date | null;
};

const syncJobDefinitions: Record<
  CoupangSyncJobType,
  {
    kind: CoupangSyncKind;
    label: string;
    operatorMessage: string;
  }
> = {
  "coupang.orders.collect": {
    kind: "orders",
    label: "주문 수집",
    operatorMessage: "쿠팡 주문 데이터를 수집했습니다.",
  },
  "coupang.products.collect": {
    kind: "products",
    label: "상품 확인",
    operatorMessage: "쿠팡 상품 상태를 확인했습니다.",
  },
  "coupang.cs.collect": {
    kind: "cs",
    label: "문의 확인",
    operatorMessage: "쿠팡 문의 데이터를 확인했습니다.",
  },
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
      payloadRef: `coupang:${definition.kind}:collect`,
      idempotencyKey: `coupang:${definition.kind}:collect`,
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
        inArray(jobs.type, [...ALL_COUPANG_SYNC_JOB_TYPES]),
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
        inArray(jobs.type, [...ALL_COUPANG_SYNC_JOB_TYPES]),
      ),
    );

  return summarizeCoupangSyncJobs(rows);
}

export function summarizeCoupangSyncJobs(
  rows: readonly CoupangSyncJobRow[],
): CoupangSyncJobSummary {
  const rowByType = new Map<CurrentCoupangSyncJobType, CoupangSyncJobRow>();

  for (const row of rows) {
    const currentType = toCurrentCoupangSyncJobType(row.type);

    if (currentType) {
      const existing = rowByType.get(currentType);

      if (!existing || isNewerRow(row, existing)) {
        rowByType.set(currentType, row);
      }
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
    const type = issue ? toCurrentCoupangSyncJobType(issue.type) : null;
    const label = type ? syncJobDefinitions[type].label : null;

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
      headline: "쿠팡 데이터 수집이 완료되었습니다.",
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
  db?: DbClient;
  env?: Pick<ServerEnv, "COUPANG_MARKET" | "PII_ENCRYPTION_KEY">;
  fetchImpl?: CoupangFetch;
  job: RunnableCoupangJob;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  status: "succeeded" | "checkpointed";
  checkpoint: JobCheckpoint;
  processedCount: number;
}> {
  if (!isCoupangSyncJobType(input.job.type)) {
    throw new Error(`Unsupported Coupang sync job: ${input.job.type}`);
  }

  if (isLegacyCoupangSyncJobType(input.job.type)) {
    return runLegacyPreparationJob(input);
  }

  if (!input.db || !input.env) {
    throw new Error("Coupang collection jobs require database and environment dependencies");
  }

  const fixedNow = input.now;

  return runCoupangCollectionJob({
    deps: {
      db: input.db,
      env: input.env,
      fetchImpl: input.fetchImpl,
      now: fixedNow ? () => fixedNow : undefined,
      sleep: input.sleep,
    },
    job: input.job,
  });
}

export function isCoupangSyncJobType(type: string): type is CoupangSyncJobType {
  return ALL_COUPANG_SYNC_JOB_TYPES.includes(type as CoupangSyncJobType);
}

export function isCurrentCoupangSyncJobType(
  type: string,
): type is CurrentCoupangSyncJobType {
  return COUPANG_SYNC_JOB_TYPES.includes(type as CurrentCoupangSyncJobType);
}

export function getCoupangNextScheduledFor(input: {
  jobType: string;
  now?: Date;
}): Date | null {
  if (!isCurrentCoupangSyncJobType(input.jobType)) {
    return null;
  }

  return new Date(
    (input.now ?? new Date()).getTime() +
      COUPANG_COLLECTION_INTERVAL_MS_BY_TYPE[input.jobType],
  );
}

export function getCoupangFailureScheduledFor(input: {
  attempts?: number | null;
  error: Error;
  jobType: string;
  now?: Date;
}): Date | null {
  if (!isCurrentCoupangSyncJobType(input.jobType)) {
    return null;
  }

  const now = input.now ?? new Date();
  const retryAfterMs =
    input.error instanceof CoupangApiError && input.error.statusCode === 429
      ? input.error.retryAfterMs
      : undefined;
  const attempts = Math.max(1, input.attempts ?? 1);
  const fallbackBackoff = Math.min(
    COUPANG_MAX_FAILURE_BACKOFF_MS,
    COUPANG_DEFAULT_FAILURE_BACKOFF_MS * 2 ** (attempts - 1),
  );

  return new Date(now.getTime() + (retryAfterMs ?? fallbackBackoff));
}

export function prepareCoupangCheckpointForNextRun(input: {
  checkpoint: JobCheckpoint;
  jobType: string;
}): JobCheckpoint {
  if (!isCurrentCoupangSyncJobType(input.jobType)) {
    return input.checkpoint;
  }

  const checkpoint = normalizeCoupangCheckpoint(
    input.checkpoint,
    syncJobDefinitions[input.jobType].kind,
  );
  const previousWindowEnd =
    typeof input.checkpoint.windowEnd === "string"
      ? input.checkpoint.windowEnd
      : undefined;

  return {
    ...checkpoint,
    cursor: null,
    stage: "queued",
    windowEnd: undefined,
    windowStart:
      input.jobType === "coupang.orders.collect" ? previousWindowEnd : undefined,
  };
}

function runLegacyPreparationJob(input: {
  job: RunnableCoupangJob;
  now?: Date;
}): {
  status: "succeeded";
  checkpoint: JobCheckpoint;
  processedCount: number;
} {
  const now = input.now ?? new Date();
  const type = input.job.type;

  if (!isLegacyCoupangSyncJobType(type)) {
    throw new Error(`Unsupported legacy Coupang sync job: ${type}`);
  }

  const definition = syncJobDefinitions[type];
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

function normalizeCoupangCheckpoint(
  value: JobCheckpoint,
  syncKind: CoupangSyncKind,
): JobCheckpoint {
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

function isLegacyCoupangSyncJobType(
  type: string,
): type is (typeof COUPANG_LEGACY_SYNC_JOB_TYPES)[number] {
  return COUPANG_LEGACY_SYNC_JOB_TYPES.includes(
    type as (typeof COUPANG_LEGACY_SYNC_JOB_TYPES)[number],
  );
}

function toCurrentCoupangSyncJobType(
  type: string,
): CurrentCoupangSyncJobType | null {
  if (COUPANG_SYNC_JOB_TYPES.includes(type as CurrentCoupangSyncJobType)) {
    return type as CurrentCoupangSyncJobType;
  }

  if (type === "coupang.orders.collection.prepare") {
    return "coupang.orders.collect";
  }

  if (type === "coupang.products.collection.prepare") {
    return "coupang.products.collect";
  }

  if (type === "coupang.cs.collection.prepare") {
    return "coupang.cs.collect";
  }

  return null;
}

function isNewerRow(row: CoupangSyncJobRow, existing: CoupangSyncJobRow): boolean {
  return (row.updatedAt?.getTime() ?? 0) >= (existing.updatedAt?.getTime() ?? 0);
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
    return "수집 중";
  }

  if (status === "succeeded") {
    return "수집 완료";
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
