export type DashboardSummaryInput = {
  openCsInquiries: number;
  fulfillmentNeeded: number;
  needsReview: number;
  newOrders: number;
  cancelReturnWarnings: number;
  trackingWaiting: number;
  trackingFailed: number;
  deadLetters: number;
  rateLimitedPercent: number;
};

export type DashboardSummary = {
  kpis: Array<{
    label: string;
    value: number;
    tone: "neutral" | "success" | "warning" | "danger";
  }>;
  primaryQueue: {
    label: string;
    count: number;
  };
  urgentItems: string[];
  thresholdWarnings: string[];
};

export function buildDashboardSummary(
  input: DashboardSummaryInput,
): DashboardSummary {
  return {
    kpis: [
      { label: "신규 주문", value: input.newOrders, tone: "neutral" },
      { label: "발주 필요", value: input.fulfillmentNeeded, tone: "success" },
      { label: "CS 미답변", value: input.openCsInquiries, tone: "warning" },
      { label: "확인 필요", value: input.needsReview, tone: "warning" },
      { label: "취소/반품 경고", value: input.cancelReturnWarnings, tone: "danger" },
      { label: "송장 실패", value: input.trackingFailed, tone: "danger" },
    ],
    primaryQueue: {
      label: "확인 필요",
      count: input.needsReview,
    },
    urgentItems: [
      `CS 미답변 ${input.openCsInquiries}건`,
      `발주 필요 ${input.fulfillmentNeeded}건`,
      `출고중지 요청 ${input.cancelReturnWarnings}건`,
      `송장 대기 ${input.trackingWaiting}건`,
      `송장 업로드 실패 ${input.trackingFailed}건`,
      `dead letter ${input.deadLetters}건`,
    ],
    thresholdWarnings:
      input.rateLimitedPercent > 20
        ? ["Coupang 429 rate over 20%"]
        : [],
  };
}
