import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./summary";

describe("dashboard summary", () => {
  it("surfaces the operator's highest priority queues and thresholds", () => {
    const summary = buildDashboardSummary({
      nonWinnerTotal: 1240,
      stopCandidates: 930,
      needsReview: 210,
      excluded: 100,
      newOrders: 12,
      autoOrderCandidates: 9,
      cancelReturnWarnings: 2,
      invoiceWaiting: 7,
      invoiceFailed: 2,
      deadLetters: 1,
      rateLimitedPercent: 21,
    });

    expect(summary.kpis).toHaveLength(6);
    expect(summary.urgentItems[0]).toContain("출고중지");
    expect(summary.thresholdWarnings).toContain("Coupang 429 rate over 20%");
    expect(summary.primaryQueue).toEqual({
      label: "확인 필요",
      count: 210,
    });
  });
});
