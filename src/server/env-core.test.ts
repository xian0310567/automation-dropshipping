import { describe, expect, it } from "vitest";
import { shouldRunProductionPreflight } from "./env-core";

describe("shouldRunProductionPreflight", () => {
  it("runs only for production runtime startup, not local builds", () => {
    expect(shouldRunProductionPreflight({ NODE_ENV: "production" })).toBe(true);
    expect(
      shouldRunProductionPreflight({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).toBe(false);
    expect(shouldRunProductionPreflight({ NODE_ENV: "development" })).toBe(false);
  });
});
