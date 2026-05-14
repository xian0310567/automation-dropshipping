import { describe, expect, it } from "vitest";
import { prepareNonWinnerApprovalBatch } from "./prepare";

describe("prepareNonWinnerApprovalBatch", () => {
  it("connects import rows to approval hashes and idempotency keys", () => {
    const batch = prepareNonWinnerApprovalBatch({
      vendorId: "vendor-1",
      actorId: "actor-1",
      sourceImportId: "import-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      expiresAt: "2026-05-15T00:00:00.000Z",
      rows: [
        {
          sellerProductId: "SP-1",
          vendorItemId: "VI-1",
          productName: "Eligible",
          nonWinnerDays: 3,
          status: "ON_SALE",
        },
      ],
    });

    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      actionType: "sales_stop",
      approvalState: "pending_approval",
      idempotencyKey: expect.stringContaining("vendor-1:sales_stop:VI-1"),
    });
    expect(batch[0]?.approvalHash).toHaveLength(64);
  });
});
