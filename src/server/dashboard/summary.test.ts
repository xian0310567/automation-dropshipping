import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./summary";

describe("dashboard summary", () => {
  it("surfaces the operator's highest priority queues and thresholds", () => {
    const summary = buildDashboardSummary({
      openCsInquiries: 18,
      fulfillmentNeeded: 9,
      needsReview: 210,
      newOrders: 12,
      cancelReturnWarnings: 2,
      trackingWaiting: 7,
      trackingFailed: 2,
      deadLetters: 1,
      rateLimitedPercent: 21,
    });

    expect(summary.kpis).toHaveLength(6);
    expect(summary.kpis.map((kpi) => kpi.label)).toContain("CS 미답변");
    expect(summary.urgentItems).toContain("출고중지 요청 2건");
    expect(summary.thresholdWarnings).toContain("Coupang 429 rate over 20%");
    expect(summary.primaryQueue).toEqual({
      label: "확인 필요",
      count: 210,
    });
  });
});
