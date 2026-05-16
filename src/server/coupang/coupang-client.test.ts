import { describe, expect, it } from "vitest";
import {
  COUPANG_MAX_REQUESTS_PER_SECOND,
  buildCoupangAuthorization,
  buildCoupangHeaders,
  buildCoupangPathWithQuery,
  formatCoupangSignedDate,
  requestCoupangJson,
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

  it("adds required signed Coupang request headers", () => {
    const headers = buildCoupangHeaders({
      credentials: {
        vendorId: "A00012345",
        accessKey: "access",
        secretKey: "secret",
      },
      market: "KR",
      method: "GET",
      pathWithQuery: "/v2/test",
      signedDate: "260513T010203Z",
    });

    expect(headers.Authorization).toContain("CEA algorithm=HmacSHA256");
    expect(headers["X-Requested-By"]).toBe("A00012345");
    expect(headers["X-MARKET"]).toBe("KR");
    expect(headers["Content-Type"]).toBe("application/json;charset=UTF-8");
  });

  it("formats Coupang HMAC timestamps in UTC", () => {
    expect(formatCoupangSignedDate(new Date("2026-05-13T01:02:03Z"))).toBe(
      "260513T010203Z",
    );
  });

  it("builds signed paths with encoded query parameters", () => {
    expect(
      buildCoupangPathWithQuery({
        path: "/v2/providers/openapi/apis/api/v5/vendors/A001/ordersheets",
        query: {
          createdAtFrom: "2026-05-13T00:00+09:00",
          status: "ACCEPT",
          empty: "",
        },
      }),
    ).toBe(
      "/v2/providers/openapi/apis/api/v5/vendors/A001/ordersheets?createdAtFrom=2026-05-13T00%3A00%2B09%3A00&status=ACCEPT",
    );
  });

  it("performs signed JSON requests without exposing raw payloads in logs", async () => {
    const requested: { headers?: Record<string, string>; url?: string } = {};
    const result = await requestCoupangJson<{
      code: number;
      data: unknown[];
      message: string;
    }>({
      baseUrl: "https://example.test",
      credentials: {
        vendorId: "A00012345",
        accessKey: "access",
        secretKey: "secret",
      },
      fetchImpl: async (url, init) => {
        requested.url = url;
        requested.headers = init.headers;

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              code: 200,
              message: "OK",
              data: [{ receiver: { name: "홍길동" } }],
            }),
        };
      },
      now: () => new Date("2026-05-13T01:02:03Z"),
      path: "/v2/test",
      query: { status: "ACCEPT" },
    });

    expect(requested.url).toBe("https://example.test/v2/test?status=ACCEPT");
    expect(requested.headers?.Authorization).toContain("signed-date=260513T010203Z");
    expect(result.body.data).toHaveLength(1);
    expect(result.log.responseSummary).toEqual({
      code: 200,
      dataCount: 1,
      hasData: true,
      message: "OK",
      nextTokenPresent: false,
    });
    expect(JSON.stringify(result.log)).not.toContain("홍길동");
  });

  it("surfaces Retry-After hints on rate-limited Coupang responses", async () => {
    await expect(
      requestCoupangJson({
        baseUrl: "https://example.test",
        credentials: {
          vendorId: "A00012345",
          accessKey: "access",
          secretKey: "secret",
        },
        fetchImpl: async () => ({
          headers: {
            get: (name) => (name.toLowerCase() === "retry-after" ? "45" : null),
          },
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ code: 429, message: "Too many" }),
        }),
        now: () => new Date("2026-05-13T01:02:03Z"),
        path: "/v2/test",
      }),
    ).rejects.toMatchObject({
      name: "CoupangApiError",
      statusCode: 429,
      retryAfterMs: 45_000,
    });
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
