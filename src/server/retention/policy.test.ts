import { describe, expect, it } from "vitest";
import { getRetentionAction } from "./policy";

describe("getRetentionAction", () => {
  it("deletes raw uploads after 30 days and preserves audit metadata for a year", () => {
    const now = new Date("2026-05-14T00:00:00.000Z");

    expect(
      getRetentionAction({
        kind: "raw_upload",
        createdAt: new Date("2026-04-13T23:59:59.000Z"),
        now,
      }),
    ).toBe("delete_raw");

    expect(
      getRetentionAction({
        kind: "audit_log",
        createdAt: new Date("2025-05-15T00:00:00.000Z"),
        now,
      }),
    ).toBe("keep");
  });
});
