import { describe, expect, it } from "vitest";
import { evaluateOwnerclanReadiness } from "./readiness";

describe("evaluateOwnerclanReadiness", () => {
  it("selects CSV fallback when API credentials are missing", () => {
    expect(
      evaluateOwnerclanReadiness({
        apiApproved: false,
        hasApiCredentials: false,
        csvFallbackConfigured: true,
      }),
    ).toEqual({
      mode: "csv_fallback",
      blockingReasons: ["Ownerclan API is not approved"],
    });
  });
});
