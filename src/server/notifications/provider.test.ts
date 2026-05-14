import { describe, expect, it } from "vitest";
import { buildNotificationMessage } from "./provider";

describe("buildNotificationMessage", () => {
  it("creates concise operator notifications", () => {
    expect(
      buildNotificationMessage({
        severity: "critical",
        title: "Coupang 429",
        detail: "429 rate exceeded 20%",
      }),
    ).toEqual("[critical] Coupang 429 - 429 rate exceeded 20%");
  });
});
