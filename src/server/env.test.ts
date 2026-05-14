import { describe, expect, it } from "vitest";
import {
  assertCronEnv,
  assertMutationEnv,
  assertProductionEnv,
  assertUploadEnv,
} from "./env-core";

const baseEnv = {
  NODE_ENV: "production" as const,
  DATABASE_URL: "postgres://runtime",
  DATABASE_DIRECT_URL: "postgres://direct",
  CRON_SECRET: "cron-secret",
  OPERATOR_API_KEY: "operator-secret",
  OPERATOR_ACTOR_ID: "actor-1",
  OPERATOR_ROLE: "owner" as const,
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
});
