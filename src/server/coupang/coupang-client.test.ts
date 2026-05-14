import { describe, expect, it } from "vitest";
import {
  COUPANG_MAX_REQUESTS_PER_SECOND,
  buildCoupangAuthorization,
  shouldPauseCoupangJobs,
} from "./coupang-client";

describe("coupang client contracts", () => {
  it("throttles under the 5 req/sec vendor policy ceiling", () => {
    expect(COUPANG_MAX_REQUESTS_PER_SECOND).toBe(4);
  });

  it("builds deterministic HMAC authorization headers", () => {
    const authorization = buildCoupangAuthorization({
      accessKey: "access",
      secretKey: "secret",
      method: "GET",
      pathWithQuery: "/v2/providers/openapi/apis/api/v4/vendors/A001/ordersheets?createdAtFrom=2026-05-13&createdAtTo=2026-05-14",
      signedDate: "260513T010203Z",
    });

    expect(authorization).toContain("CEA algorithm=HmacSHA256");
    expect(authorization).toContain("access-key=access");
    expect(authorization).toContain("signed-date=260513T010203Z");
    expect(authorization).toMatch(/signature=[a-f0-9]{64}/);
  });

  it("pauses jobs when 429 rate exceeds 20 percent over the window", () => {
    expect(shouldPauseCoupangJobs({ totalRequests: 100, rateLimited: 21 })).toBe(
      true,
    );
    expect(shouldPauseCoupangJobs({ totalRequests: 100, rateLimited: 20 })).toBe(
      false,
    );
  });
});
