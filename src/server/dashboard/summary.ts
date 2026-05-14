export type DashboardSummaryInput = {
  nonWinnerTotal: number;
  stopCandidates: number;
  needsReview: number;
  excluded: number;
  newOrders: number;
  autoOrderCandidates: number;
  cancelReturnWarnings: number;
  invoiceWaiting: number;
  invoiceFailed: number;
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
      { label: "비위너 감지", value: input.nonWinnerTotal, tone: "neutral" },
      { label: "판매중지 후보", value: input.stopCandidates, tone: "success" },
      { label: "확인 필요", value: input.needsReview, tone: "warning" },
      { label: "신규 주문", value: input.newOrders, tone: "neutral" },
      { label: "취소/반품 경고", value: input.cancelReturnWarnings, tone: "danger" },
      { label: "송장 실패", value: input.invoiceFailed, tone: "danger" },
    ],
    primaryQueue: {
      label: "확인 필요",
      count: input.needsReview,
    },
    urgentItems: [
      `출고중지 요청 ${input.cancelReturnWarnings}건`,
      `송장 업로드 실패 ${input.invoiceFailed}건`,
      `dead letter ${input.deadLetters}건`,
    ],
    thresholdWarnings:
      input.rateLimitedPercent > 20
        ? ["Coupang 429 rate over 20%"]
        : [],
  };
}
