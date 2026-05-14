import { describe, expect, it } from "vitest";
import { generateNonWinnerCandidates } from "./non-winner-candidates";

describe("generateNonWinnerCandidates", () => {
  it("generates approval-required sales-stop candidates and excludes risky rows", () => {
    const candidates = generateNonWinnerCandidates({
      vendorId: "vendor-1",
      importedRows: [
        {
          sellerProductId: "SP-1",
          vendorItemId: "VI-1",
          productName: "Eligible",
          nonWinnerDays: 3,
          status: "ON_SALE",
        },
        {
          sellerProductId: "SP-2",
          vendorItemId: "VI-2",
          productName: "Recent order",
          nonWinnerDays: 5,
          status: "ON_SALE",
          hasRecentOrder: true,
        },
      ],
      sourceImportId: "import-1",
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        actionType: "sales_stop",
        vendorId: "vendor-1",
        sellerProductId: "SP-1",
        vendorItemId: "VI-1",
        requiresApproval: true,
        reason: "Non-winner for 3 days",
      }),
    ]);
  });
});
