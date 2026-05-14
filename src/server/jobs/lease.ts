import { JOB_LEASE_TTL_MS, hasLeaseExpired } from "./job-policy";

export const JOB_LEASE_SQL = `
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
RETURNING jobs.id, jobs.type, jobs.payload_ref, jobs.idempotency_key, jobs.checkpoint;
`;

export type ClaimableJob = {
  id: string;
  status: "queued" | "retrying" | "leased" | "running" | "succeeded";
  scheduledFor: Date;
  leaseExpiresAt: Date | null;
  leaseOwner?: string | null;
};

export function claimRunnableJobInMemory(input: {
  jobs: readonly ClaimableJob[];
  leaseOwner: string;
  now?: Date;
}): { claimed: ClaimableJob | null; jobs: ClaimableJob[] } {
  const now = input.now ?? new Date();
  const jobs = input.jobs.map((job) => ({
    ...job,
    leaseOwner: job.leaseOwner ?? null,
  }));
  const sortedJobs = [...jobs].sort(
    (left, right) =>
      left.scheduledFor.getTime() - right.scheduledFor.getTime() ||
      left.id.localeCompare(right.id),
  );

  const claimed = sortedJobs.find((job) => {
    const scheduled = job.scheduledFor.getTime() <= now.getTime();
    const leaseOpen =
      job.leaseExpiresAt === null ||
      hasLeaseExpired({ leaseExpiresAt: job.leaseExpiresAt, now });
    const runnableStatus =
      job.status === "queued" ||
      job.status === "retrying" ||
      (job.status === "leased" && leaseOpen);

    return runnableStatus && scheduled && leaseOpen;
  });

  if (!claimed) {
    return { claimed: null, jobs };
  }

  const leasedJob: ClaimableJob = {
    ...claimed,
    status: "leased",
    leaseOwner: input.leaseOwner,
    leaseExpiresAt: new Date(now.getTime() + JOB_LEASE_TTL_MS),
  };

  return {
    claimed: leasedJob,
    jobs: jobs.map((job) => (job.id === claimed.id ? leasedJob : job)),
  };
}
