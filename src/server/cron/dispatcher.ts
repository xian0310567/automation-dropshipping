import { sql, type SQLWrapper } from "drizzle-orm";
import {
  isCoupangSyncJobType,
  runCoupangSyncJob,
} from "@/server/coupang/sync-jobs";
import type { DbClient } from "@/server/db/client";
import { runBoundedJob, type JobCheckpoint } from "@/server/jobs/runner";

export type LeasedJob = {
  id: string;
  tenantId?: string | null;
  type: string;
  payloadRef?: string | null;
  idempotencyKey?: string | null;
  checkpoint: JobCheckpoint;
  leaseOwner: string;
  leaseExpiresAt?: Date | null;
  attempts?: number;
  scheduledFor?: Date | null;
};

export type CronDispatchResult =
  | {
      dispatched: 0;
    }
  | {
      dispatched: 1;
      jobId: string;
      jobType: string;
      status: "succeeded" | "checkpointed" | "failed";
      processedCount: number;
      error?: string;
    };

export const JOB_CLAIM_SQL = `
WITH next_job AS (
  SELECT id
  FROM jobs
  WHERE scheduled_for <= now()
    AND (
      status IN ('queued', 'retrying')
      OR (status = 'leased' AND lease_expires_at < now())
    )
    AND (lease_expires_at IS NULL OR lease_expires_at < now())
  ORDER BY scheduled_for ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE jobs
SET status = 'leased',
    lease_owner = $1,
    lease_expires_at = now() + interval '10 minutes',
    attempts = attempts + 1,
    updated_at = now()
FROM next_job
WHERE jobs.id = next_job.id
RETURNING jobs.id,
          jobs.tenant_id,
          jobs.type,
          jobs.payload_ref,
          jobs.idempotency_key,
          jobs.checkpoint,
          jobs.lease_expires_at,
          jobs.attempts,
          jobs.scheduled_for;
`;

export async function dispatchCronOnce(input: {
  leaseOwner: string;
  claimJob: (leaseOwner: string) => Promise<LeasedJob | null>;
  runJob?: (job: LeasedJob) => Promise<{
    status: "succeeded" | "checkpointed";
    checkpoint: JobCheckpoint;
    processedCount: number;
  }>;
  markJobFinished: (
    job: LeasedJob,
    result: {
      status: "succeeded" | "checkpointed";
      checkpoint: JobCheckpoint;
      processedCount: number;
    },
  ) => Promise<void>;
  markJobFailed: (job: LeasedJob, error: Error) => Promise<void>;
}): Promise<CronDispatchResult> {
  const job = await input.claimJob(input.leaseOwner);

  if (!job) {
    return { dispatched: 0 };
  }

  try {
    const result = input.runJob
      ? await input.runJob(job)
      : await runRegisteredJob(job);
    await input.markJobFinished(job, result);

    return {
      dispatched: 1,
      jobId: job.id,
      jobType: job.type,
      status: result.status,
      processedCount: result.processedCount,
    };
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Unknown cron job failure");
    await input.markJobFailed(job, normalizedError);

    return {
      dispatched: 1,
      jobId: job.id,
      jobType: job.type,
      status: "failed",
      processedCount: 0,
      error: normalizedError.message,
    };
  }
}

export async function claimNextJob(
  db: DbClient,
  leaseOwner: string,
): Promise<LeasedJob | null> {
  const result = await db.execute(sql`
    WITH next_job AS (
      SELECT id
      FROM jobs
      WHERE scheduled_for <= now()
        AND (
          status IN ('queued', 'retrying')
          OR (status = 'leased' AND lease_expires_at < now())
        )
        AND (lease_expires_at IS NULL OR lease_expires_at < now())
      ORDER BY scheduled_for ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE jobs
    SET status = 'leased',
        lease_owner = ${leaseOwner},
        lease_expires_at = now() + interval '10 minutes',
        attempts = attempts + 1,
        updated_at = now()
    FROM next_job
    WHERE jobs.id = next_job.id
    RETURNING jobs.id,
              jobs.tenant_id,
              jobs.type,
              jobs.payload_ref,
              jobs.idempotency_key,
              jobs.checkpoint,
              jobs.lease_expires_at,
              jobs.attempts,
              jobs.scheduled_for;
  `);
  const row = getRows(result)[0];

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    type: String(row.type),
    payloadRef: row.payload_ref ? String(row.payload_ref) : null,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    checkpoint: asCheckpoint(row.checkpoint),
    leaseOwner,
    leaseExpiresAt: asOptionalDate(row.lease_expires_at),
    attempts: asNumber(row.attempts),
    scheduledFor: asOptionalDate(row.scheduled_for),
  };
}

export async function markJobFinished(
  db: DbClient,
  job: LeasedJob,
  result: {
    status: "succeeded" | "checkpointed";
    checkpoint: JobCheckpoint;
    processedCount: number;
  },
): Promise<void> {
  const status = result.status === "succeeded" ? "succeeded" : "queued";

  await db.transaction(async (tx) => {
    const updated = await updateOwnedJobLease(tx, sql`
      UPDATE jobs
      SET status = ${status},
          checkpoint = ${JSON.stringify(result.checkpoint)}::jsonb,
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE id = ${job.id}
        AND lease_owner = ${job.leaseOwner}
      RETURNING id, tenant_id, status, attempts, scheduled_for;
    `);

    await tx.execute(sql`
      INSERT INTO job_runs (
        tenant_id,
        job_id,
        status,
        lease_owner,
        lease_expires_at,
        attempts,
        checkpoint,
        processed_count,
        scheduled_for,
        finished_at
      )
      VALUES (
        ${updated.tenantId ?? job.tenantId ?? null},
        ${updated.id},
        ${status},
        ${job.leaseOwner},
        ${job.leaseExpiresAt ?? null},
        ${updated.attempts ?? job.attempts ?? 0},
        ${JSON.stringify(result.checkpoint)}::jsonb,
        ${result.processedCount},
        ${updated.scheduledFor ?? job.scheduledFor ?? null},
        now()
      );
    `);
  });
}

export async function markJobFailed(
  db: DbClient,
  job: LeasedJob,
  error: Error,
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await updateOwnedJobLease(tx, sql`
      UPDATE jobs
      SET status = CASE WHEN attempts >= 5 THEN 'dead_lettered' ELSE 'retrying' END,
          last_error = ${error.message},
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE id = ${job.id}
        AND lease_owner = ${job.leaseOwner}
      RETURNING id, tenant_id, status, attempts, scheduled_for, checkpoint;
    `);
    const finalStatus =
      updated.status === "dead_lettered" ? "dead_lettered" : "retrying";
    const runResult = await tx.execute(sql`
      INSERT INTO job_runs (
        tenant_id,
        job_id,
        status,
        lease_owner,
        lease_expires_at,
        attempts,
        checkpoint,
        processed_count,
        error_message,
        scheduled_for,
        finished_at
      )
      VALUES (
        ${updated.tenantId ?? job.tenantId ?? null},
        ${updated.id},
        ${finalStatus},
        ${job.leaseOwner},
        ${job.leaseExpiresAt ?? null},
        ${updated.attempts ?? job.attempts ?? 0},
        ${JSON.stringify(updated.checkpoint ?? job.checkpoint)}::jsonb,
        0,
        ${error.message},
        ${updated.scheduledFor ?? job.scheduledFor ?? null},
        now()
      )
      RETURNING id;
    `);
    const runId = getRows(runResult)[0]?.id;

    if (finalStatus === "dead_lettered") {
      await tx.execute(sql`
        INSERT INTO dead_letters (
          tenant_id,
          source_job_run_id,
          reason,
          payload
        )
        VALUES (
          ${updated.tenantId ?? job.tenantId ?? null},
          ${runId ? String(runId) : null},
          ${error.message},
          ${JSON.stringify({
            jobId: updated.id,
            jobType: job.type,
            checkpoint: updated.checkpoint ?? job.checkpoint,
          })}::jsonb
        );
      `);
    }
  });
}

export async function runRegisteredJob(job: LeasedJob) {
  if (isCoupangSyncJobType(job.type)) {
    return runCoupangSyncJob({ job });
  }

  if (job.type !== "retention.cleanup") {
    throw new Error(`No registered job handler for ${job.type}`);
  }

  return runBoundedJob({
    checkpoint: job.checkpoint,
    handler: async ({ checkpoint }) => ({
      checkpoint: {
        ...checkpoint,
        lastCronLeaseAt: new Date().toISOString(),
      },
      processedCount: 0,
      done: true,
    }),
  });
}

function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }

  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as Record<string, unknown>[];
  }

  return [];
}

type JobTransitionRow = {
  id: string;
  tenantId: string | null;
  status: string;
  attempts: number | null;
  scheduledFor: Date | null;
  checkpoint?: JobCheckpoint;
};

type TransactionExecutor = {
  execute: (query: string | SQLWrapper) => Promise<unknown>;
};

async function updateOwnedJobLease(
  tx: TransactionExecutor,
  query: string | SQLWrapper,
): Promise<JobTransitionRow> {
  const row = getRows(await tx.execute(query))[0];

  if (!row) {
    throw new Error("Job lease is no longer owned by this worker");
  }

  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    status: String(row.status),
    attempts: row.attempts === undefined ? null : asNumber(row.attempts),
    scheduledFor: asOptionalDate(row.scheduled_for),
    checkpoint:
      row.checkpoint && typeof row.checkpoint === "object" && !Array.isArray(row.checkpoint)
        ? (row.checkpoint as JobCheckpoint)
        : undefined,
  };
}

export function asCheckpoint(value: unknown): JobCheckpoint {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JobCheckpoint;
  }

  throw new Error("Invalid job checkpoint");
}

function asOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}
