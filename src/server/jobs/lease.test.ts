import { describe, expect, it } from "vitest";
import { JOB_LEASE_SQL, claimRunnableJobInMemory } from "./lease";

describe("job lease acquisition", () => {
  it("documents a collision-safe Postgres lease statement", () => {
    expect(JOB_LEASE_SQL).toContain("FOR UPDATE SKIP LOCKED");
    expect(JOB_LEASE_SQL).toContain("lease_expires_at");
    expect(JOB_LEASE_SQL).toContain("idempotency_key");
    expect(JOB_LEASE_SQL).toContain("status = 'leased'");
    expect(JOB_LEASE_SQL).toContain("lease_expires_at < now()");
  });

  it("claims only one runnable job and leaves expired-future leases alone", () => {
    const now = new Date("2026-05-14T00:00:00.000Z");
    const result = claimRunnableJobInMemory({
      now,
      leaseOwner: "worker-a",
      jobs: [
        {
          id: "later",
          status: "queued",
          scheduledFor: new Date("2026-05-14T01:00:00.000Z"),
          leaseExpiresAt: null,
        },
        {
          id: "ready",
          status: "queued",
          scheduledFor: new Date("2026-05-13T23:59:00.000Z"),
          leaseExpiresAt: null,
        },
      ],
    });

    expect(result.claimed?.id).toBe("ready");
    expect(result.claimed?.status).toBe("leased");
    expect(result.jobs.find((job) => job.id === "later")?.leaseOwner).toBeNull();
  });

  it("reclaims abandoned leased jobs after their lease expires", () => {
    const now = new Date("2026-05-14T00:10:01.000Z");
    const result = claimRunnableJobInMemory({
      now,
      leaseOwner: "worker-b",
      jobs: [
        {
          id: "abandoned",
          status: "leased",
          scheduledFor: new Date("2026-05-14T00:00:00.000Z"),
          leaseExpiresAt: new Date("2026-05-14T00:10:00.000Z"),
          leaseOwner: "worker-a",
        },
      ],
    });

    expect(result.claimed?.id).toBe("abandoned");
    expect(result.claimed?.leaseOwner).toBe("worker-b");
  });
});
