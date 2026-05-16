import { describe, expect, it } from "vitest";
import {
  asCheckpoint,
  dispatchCronOnce,
  JOB_CLAIM_SQL,
  markJobFailed,
  markJobFinished,
  runRegisteredJob,
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

  it("keeps legacy Coupang preparation jobs executable through the registered handler", async () => {
    await expect(
      runRegisteredJob({
        id: "job-coupang-orders",
        tenantId: "tenant-1",
        type: "coupang.orders.collection.prepare",
        checkpoint: {
          provider: "coupang",
          syncKind: "orders",
          stage: "queued",
          cursor: null,
        },
        leaseOwner: "cron-test",
      }),
    ).resolves.toMatchObject({
      status: "succeeded",
      processedCount: 0,
      checkpoint: {
        provider: "coupang",
        syncKind: "orders",
        stage: "ready_for_collection",
      },
    });
  });

  it("requires runtime dependencies before dispatching live Coupang collection jobs", async () => {
    await expect(
      runRegisteredJob({
        id: "job-coupang-orders",
        tenantId: "tenant-1",
        type: "coupang.orders.collect",
        checkpoint: {
          provider: "coupang",
          syncKind: "orders",
          stage: "queued",
          cursor: null,
        },
        leaseOwner: "cron-test",
      }),
    ).rejects.toThrow(/database and environment/i);
  });

  it("does not record finished-run evidence when the lease transition is stale", async () => {
    const executed: unknown[] = [];
    const db = {
      transaction: async (
        callback: (tx: { execute: (query: unknown) => Promise<{ rows: unknown[] }> }) => Promise<void>,
      ) =>
        callback({
          execute: async (query: unknown) => {
            executed.push(query);
            return { rows: [] };
          },
        }),
    };

    await expect(
      markJobFinished(
        db as never,
        {
          id: "job-1",
          type: "retention.cleanup",
          checkpoint: {},
          leaseOwner: "stale-worker",
        },
        {
          status: "succeeded",
          checkpoint: {},
          processedCount: 0,
        },
      ),
    ).rejects.toThrow(/lease is no longer owned/i);
    expect(executed).toHaveLength(1);
  });

  it("does not record failed-run evidence when the lease transition is stale", async () => {
    const executed: unknown[] = [];
    const db = {
      transaction: async (
        callback: (tx: { execute: (query: unknown) => Promise<{ rows: unknown[] }> }) => Promise<void>,
      ) =>
        callback({
          execute: async (query: unknown) => {
            executed.push(query);
            return { rows: [] };
          },
        }),
    };

    await expect(
      markJobFailed(
        db as never,
        {
          id: "job-1",
          type: "retention.cleanup",
          checkpoint: {},
          leaseOwner: "stale-worker",
        },
        new Error("boom"),
      ),
    ).rejects.toThrow(/lease is no longer owned/i);
    expect(executed).toHaveLength(1);
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
    expect(JOB_CLAIM_SQL).toContain("jobs.tenant_id");
    expect(JOB_CLAIM_SQL).toContain("jobs.attempts");
  });
});
