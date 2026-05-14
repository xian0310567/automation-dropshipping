export type FallbackMetricInput = {
  importBytes: number;
  importRows: number;
  p95RuntimeSeconds: number;
  cronLagMinutes: number;
  deadLetterRate: number;
  timeoutRate: number;
  retryAttempts: number;
  rateLimit429Rate: number;
};

export type FallbackTrigger =
  | "import_size"
  | "p95_runtime"
  | "cron_lag"
  | "dead_letter_rate"
  | "timeout_rate"
  | "retry_volume"
  | "coupang_429_rate";

export function evaluateFallbackThresholds(
  input: FallbackMetricInput,
): FallbackTrigger[] {
  const triggers: FallbackTrigger[] = [];

  if (input.importBytes > 50 * 1024 * 1024 || input.importRows > 100_000) {
    triggers.push("import_size");
  }

  if (input.p95RuntimeSeconds > 240) {
    triggers.push("p95_runtime");
  }

  if (input.cronLagMinutes > 15) {
    triggers.push("cron_lag");
  }

  if (input.deadLetterRate > 0.05) {
    triggers.push("dead_letter_rate");
  }

  if (input.timeoutRate > 0.05) {
    triggers.push("timeout_rate");
  }

  if (input.retryAttempts > 5) {
    triggers.push("retry_volume");
  }

  if (input.rateLimit429Rate > 0.2) {
    triggers.push("coupang_429_rate");
  }

  return triggers;
}
