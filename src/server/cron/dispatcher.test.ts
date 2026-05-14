import { describe, expect, it } from "vitest";
import {
  asCheckpoint,
  dispatchCronOnce,
  JOB_CLAIM_SQL,
} from "./dispatcher";

describe("dispatchCronOnce", () => {
  it("claims a leased job and runs it through the bounded job runner", async () => {
    const result = await dispatchCronOnce({
      leaseOwner: "cron-test",
      claimJob: async () => ({
        id: "job-1",
        type: "retention.cleanup",
        checkpoint: { cursor: 0 },
        leaseOwner: "cron-test",
      }),
      runJob: async ({ checkpoint }) => ({
        status: "succeeded",
        checkpoint,
        processedCount: 2,
      }),
      markJobFinished: async () => undefined,
      markJobFailed: async () => undefined,
    });

    expect(result).toEqual({
      dispatched: 1,
      jobId: "job-1",
      jobType: "retention.cleanup",
      status: "succeeded",
      processedCount: 2,
    });
  });

  it("does no work when no DB lease can be claimed", async () => {
    await expect(
      dispatchCronOnce({
        leaseOwner: "cron-test",
        claimJob: async () => null,
        runJob: async () => {
          throw new Error("must not run");
        },
        markJobFinished: async () => undefined,
        markJobFailed: async () => undefined,
      }),
    ).resolves.toEqual({ dispatched: 0 });
  });

  it("marks claimed jobs failed when a handler rejects", async () => {
    const failed: string[] = [];
    const result = await dispatchCronOnce({
      leaseOwner: "cron-test",
      claimJob: async () => ({
        id: "job-1",
        type: "unknown",
        checkpoint: {},
        leaseOwner: "cron-test",
      }),
      runJob: async () => {
        throw new Error("No registered job handler");
      },
      markJobFinished: async () => undefined,
      markJobFailed: async (job, error) => {
        failed.push(`${job.id}:${error.message}`);
      },
    });

    expect(result).toMatchObject({
      dispatched: 1,
      jobId: "job-1",
      status: "failed",
    });
    expect(failed).toEqual(["job-1:No registered job handler"]);
  });

  it("keeps lease ownership attached to the claimed job", async () => {
    const job = {
      id: "job-1",
      type: "retention.cleanup",
      checkpoint: {},
      leaseOwner: "worker-1",
    };

    const result = await dispatchCronOnce({
      leaseOwner: "worker-1",
      claimJob: async () => job,
      runJob: async ({ leaseOwner }) => ({
        status: "succeeded",
        checkpoint: { leaseOwner },
        processedCount: 1,
      }),
      markJobFinished: async (leasedJob) => {
        expect(leasedJob.leaseOwner).toBe("worker-1");
      },
      markJobFailed: async () => undefined,
    });

    expect(result).toMatchObject({ status: "succeeded" });
  });
});

describe("asCheckpoint", () => {
  it("fails loudly when persisted job checkpoint is not an object", () => {
    expect(() => asCheckpoint("not-json-object")).toThrow(/invalid job checkpoint/i);
  });
});

describe("JOB_CLAIM_SQL", () => {
  it("includes expired leased jobs for abandoned lease recovery", () => {
    expect(JOB_CLAIM_SQL).toContain("status IN ('queued', 'retrying')");
    expect(JOB_CLAIM_SQL).toContain("status = 'leased'");
    expect(JOB_CLAIM_SQL).toContain("lease_expires_at < now()");
  });
});
