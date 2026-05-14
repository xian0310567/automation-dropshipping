import type { WingNormalizedRow } from "./wing-parser";

export type NonWinnerCandidate = {
  actionType: "sales_stop";
  vendorId: string;
  sellerProductId: string;
  vendorItemId: string;
  productName: string;
  sourceImportId: string;
  reason: string;
  riskFlags: string[];
  requiresApproval: true;
};

export function generateNonWinnerCandidates(input: {
  vendorId: string;
  sourceImportId: string;
  importedRows: readonly WingNormalizedRow[];
  minimumNonWinnerDays?: number;
}): NonWinnerCandidate[] {
  const minimumNonWinnerDays = input.minimumNonWinnerDays ?? 3;

  return input.importedRows.flatMap((row) => {
    const riskFlags = getRiskFlags(row);

    if (
      row.nonWinnerDays < minimumNonWinnerDays ||
      row.status !== "ON_SALE" ||
      riskFlags.includes("recent_order") ||
      riskFlags.includes("open_claim")
    ) {
      return [];
    }

    return [
      {
        actionType: "sales_stop" as const,
        vendorId: input.vendorId,
        sellerProductId: row.sellerProductId,
        vendorItemId: row.vendorItemId,
        productName: row.productName,
        sourceImportId: input.sourceImportId,
        reason: `Non-winner for ${row.nonWinnerDays} days`,
        riskFlags,
        requiresApproval: true as const,
      },
    ];
  });
}

function getRiskFlags(row: WingNormalizedRow): string[] {
  const flags: string[] = [];

  if (row.hasRecentOrder) {
    flags.push("recent_order");
  }

  if (row.hasOpenClaim) {
    flags.push("open_claim");
  }

  return flags;
}
