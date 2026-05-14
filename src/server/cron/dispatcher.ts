import { sql } from "drizzle-orm";
import type { DbClient } from "@/server/db/client";
import { runBoundedJob, type JobCheckpoint } from "@/server/jobs/runner";

export type LeasedJob = {
  id: string;
  type: string;
  checkpoint: JobCheckpoint;
  leaseOwner: string;
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
RETURNING jobs.id, jobs.type, jobs.checkpoint;
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
    RETURNING jobs.id, jobs.type, jobs.checkpoint;
  `);
  const row = getRows(result)[0];

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    type: String(row.type),
    checkpoint: asCheckpoint(row.checkpoint),
    leaseOwner,
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
  await db.execute(sql`
    UPDATE jobs
    SET status = ${status},
        checkpoint = ${JSON.stringify(result.checkpoint)}::jsonb,
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = ${job.id}
      AND lease_owner = ${job.leaseOwner};
  `);
}

export async function markJobFailed(
  db: DbClient,
  job: LeasedJob,
  error: Error,
): Promise<void> {
  await db.execute(sql`
    UPDATE jobs
    SET status = CASE WHEN attempts >= 5 THEN 'dead_lettered' ELSE 'retrying' END,
        last_error = ${error.message},
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = ${job.id}
      AND lease_owner = ${job.leaseOwner};
  `);
}

async function runRegisteredJob(job: LeasedJob) {
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

export function asCheckpoint(value: unknown): JobCheckpoint {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JobCheckpoint;
  }

  throw new Error("Invalid job checkpoint");
}
