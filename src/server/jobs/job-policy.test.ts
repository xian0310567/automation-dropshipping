import { describe, expect, it } from "vitest";
import {
  JOB_INVOCATION_BUDGET_MS,
  JOB_LEASE_TTL_MS,
  createJobIdempotencyKey,
  hasLeaseExpired,
  shouldCheckpoint,
  shouldDeadLetter,
} from "./job-policy";

describe("job policy", () => {
  it("uses a 10 minute lease TTL and checkpoints before the 240 second budget", () => {
    expect(JOB_LEASE_TTL_MS).toBe(10 * 60 * 1000);
    expect(JOB_INVOCATION_BUDGET_MS).toBe(240 * 1000);
    expect(shouldCheckpoint({ elapsedMs: 241_000 })).toBe(true);
    expect(shouldCheckpoint({ elapsedMs: 30_000 })).toBe(false);
  });

  it("does not allow expired leases to execute", () => {
    const now = new Date("2026-05-13T00:10:01.000Z");
    expect(
      hasLeaseExpired({
        leaseExpiresAt: new Date("2026-05-13T00:10:00.000Z"),
        now,
      }),
    ).toBe(true);
  });

  it("dead-letters jobs after five attempts or 24 hours stuck", () => {
    const now = new Date("2026-05-14T00:00:01.000Z");

    expect(shouldDeadLetter({ attempts: 5, firstQueuedAt: now, now })).toBe(true);
    expect(
      shouldDeadLetter({
        attempts: 1,
        firstQueuedAt: new Date("2026-05-13T00:00:00.000Z"),
        now,
      }),
    ).toBe(true);
  });

  it("builds stable mutation idempotency keys from the full approved target", () => {
    const key = createJobIdempotencyKey({
      vendorId: "A00123456",
      actionType: "COUPANG_STOP_SALE",
      targetId: "sellerProductId:987654321",
      approvalId: "approval-1",
      approvalHash: "a".repeat(64),
      targetState: "STOPPED",
    });

    expect(key).toBe(
      "A00123456:COUPANG_STOP_SALE:sellerProductId:987654321:approval-1:" +
        `${"a".repeat(64)}:STOPPED`,
    );
  });
});
