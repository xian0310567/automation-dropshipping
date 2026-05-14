import { describe, expect, it } from "vitest";
import { evaluateFallbackThresholds } from "./fallback";

describe("evaluateFallbackThresholds", () => {
  it("flags the external worker migration triggers from the plan", () => {
    expect(
      evaluateFallbackThresholds({
        importBytes: 51 * 1024 * 1024,
        importRows: 10,
        p95RuntimeSeconds: 241,
        cronLagMinutes: 16,
        deadLetterRate: 0.01,
        timeoutRate: 0.01,
        retryAttempts: 2,
        rateLimit429Rate: 0.21,
      }),
    ).toEqual([
      "import_size",
      "p95_runtime",
      "cron_lag",
      "coupang_429_rate",
    ]);
  });
});
