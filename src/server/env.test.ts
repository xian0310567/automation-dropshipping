import { describe, expect, it } from "vitest";
import {
  assertApprovalEnv,
  assertCronEnv,
  assertMutationEnv,
  assertProductionEnv,
  assertUploadEnv,
  shouldRunProductionPreflight,
} from "./env-core";

const baseEnv = {
  NODE_ENV: "production" as const,
  DATABASE_URL: "postgres://runtime",
  DATABASE_DIRECT_URL: "postgres://direct",
  CRON_SECRET: "cron-secret",
  OPERATOR_API_KEY: "operator-secret",
  OPERATOR_ACTOR_ID: "actor-1",
  OPERATOR_ROLE: "owner" as const,
  AUTH_PROVIDER_MODE: "clerk" as const,
  AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: "false" as const,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "sk_test_example",
  BLOB_READ_WRITE_TOKEN: "blob-secret",
  COUPANG_VENDOR_ID: "vendor-1",
  COUPANG_ACCESS_KEY: "access",
  COUPANG_SECRET_KEY: "secret",
  COUPANG_MARKET: "KR",
  PII_ENCRYPTION_KEY: "encryption-key",
  NOTIFICATION_PROVIDER: "none" as const,
};

describe("env validation", () => {
  it("checks cron, upload, mutation, and production secret groups", () => {
    expect(() => assertCronEnv(baseEnv)).not.toThrow();
    expect(() => assertUploadEnv(baseEnv)).not.toThrow();
    expect(() => assertApprovalEnv(baseEnv)).not.toThrow();
    expect(() => assertMutationEnv(baseEnv)).not.toThrow();
    expect(() => assertProductionEnv(baseEnv)).not.toThrow();
  });

  it("fails production validation when Blob or Cron secrets are missing", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        CRON_SECRET: undefined,
        BLOB_READ_WRITE_TOKEN: undefined,
      }),
    ).toThrow(/CRON_SECRET/);
  });

  it("requires Clerk mode for public production SaaS deployments", () => {
    expect(() =>
      assertProductionEnv({
        ...baseEnv,
        AUTH_PROVIDER_MODE: "development",
      }),
    ).toThrow(/AUTH_PROVIDER_MODE=clerk/);
  });

  it("does not require temporary operator credentials for session uploads", () => {
    expect(() =>
      assertUploadEnv({
        ...baseEnv,
        OPERATOR_API_KEY: undefined,
        OPERATOR_ACTOR_ID: undefined,
      }),
    ).not.toThrow();
  });

  it("allows Playwright to run a production build with development auth", () => {
    expect(
      shouldRunProductionPreflight({
        NODE_ENV: "production",
        E2E_TEST_MODE: "true",
      }),
    ).toBe(false);
  });
});
