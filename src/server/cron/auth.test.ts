import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "./auth";

describe("cron auth", () => {
  it("requires Vercel CRON_SECRET bearer authorization before doing work", () => {
    expect(
      authorizeCronRequest({
        authorization: undefined,
        cronSecret: "secret",
      }).ok,
    ).toBe(false);

    expect(
      authorizeCronRequest({
        authorization: "Bearer wrong",
        cronSecret: "secret",
      }).status,
    ).toBe(401);

    expect(
      authorizeCronRequest({
        authorization: "Bearer secret",
        cronSecret: "secret",
      }).ok,
    ).toBe(true);
  });
});
