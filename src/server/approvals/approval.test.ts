import { describe, expect, it } from "vitest";
import {
  buildApprovalHash,
  canExecuteApproval,
  createApprovalDeniedAudit,
  transitionApproval,
} from "./approval";

const basePayload = {
  actionType: "COUPANG_STOP_SALE",
  vendorId: "A00123456",
  actorId: "owner-1",
  targetIds: {
    sellerProductId: "987654321",
    vendorItemId: "123456789",
  },
  payload: {
    requestedStatus: "STOPPED",
  },
  sourceImportId: "import-1",
  riskFlags: ["non_winner_3_days"],
  createdAt: "2026-05-13T00:00:00.000Z",
  expiresAt: "2026-05-14T00:00:00.000Z",
  requestVersion: 1,
} as const;

describe("approval contracts", () => {
  it("changes the approval hash when any action payload field changes", () => {
    const firstHash = buildApprovalHash(basePayload);
    const secondHash = buildApprovalHash({
      ...basePayload,
      payload: { requestedStatus: "DELETED" },
    });

    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHash).not.toBe(secondHash);
  });

  it("blocks rejected and expired approvals from execution", () => {
    expect(canExecuteApproval({ state: "rejected" })).toBe(false);
    expect(canExecuteApproval({ state: "expired" })).toBe(false);
    expect(canExecuteApproval({ state: "approved" })).toBe(true);
  });

  it("records a denial audit row when an approval cannot execute", () => {
    const audit = createApprovalDeniedAudit({
      approvalId: "approval-1",
      actorId: "operator-1",
      state: "expired",
      reason: "Approval expired before execution",
    });

    expect(audit.eventType).toBe("approval.execution_denied");
    expect(audit.previousState).toBe("expired");
    expect(audit.nextState).toBe("expired");
    expect(audit.reason).toContain("expired");
  });

  it("rejects invalid state transitions", () => {
    expect(() =>
      transitionApproval({
        approvalId: "approval-1",
        from: "rejected",
        to: "executing",
        actorId: "admin-1",
        reason: "try to execute",
      }),
    ).toThrow(/invalid approval transition/i);
  });
});
