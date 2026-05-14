import { describe, expect, it } from "vitest";
import { executeApprovedNonWinnerMutation } from "./execute";

describe("executeApprovedNonWinnerMutation", () => {
  it("blocks rejected approvals and records a denial audit event", async () => {
    const result = await executeApprovedNonWinnerMutation({
      approval: {
        id: "approval-1",
        state: "rejected",
        actionType: "sales_stop",
        vendorId: "vendor-1",
        approvalHash: "hash",
        targetId: "VI-1",
      },
      actorId: "actor-1",
      submitMutation: async () => ({ providerRequestId: "never" }),
    });

    expect(result.status).toBe("denied");
    expect(result.audit.eventType).toBe("approval.execution_denied");
  });

  it("submits approved mutations once with the provided idempotency key", async () => {
    const calls: string[] = [];
    const result = await executeApprovedNonWinnerMutation({
      approval: {
        id: "approval-1",
        state: "approved",
        actionType: "sales_stop",
        vendorId: "vendor-1",
        approvalHash: "hash",
        targetId: "VI-1",
      },
      actorId: "actor-1",
      idempotencyKey: "vendor-1:sales_stop:VI-1:approval-1:hash:stopped",
      submitMutation: async ({ idempotencyKey }) => {
        calls.push(idempotencyKey);
        return { providerRequestId: "coupang-1" };
      },
    });

    expect(result.status).toBe("submitted");
    expect(calls).toEqual(["vendor-1:sales_stop:VI-1:approval-1:hash:stopped"]);
  });
});
