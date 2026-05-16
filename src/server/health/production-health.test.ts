import { describe, expect, it } from "vitest";
import {
  buildProductionHealthReport,
  type ProductionHealthEnv,
} from "./production-health";

const readyEnv: ProductionHealthEnv = {
  AUTH_PROVIDER_MODE: "password",
  BLOB_READ_WRITE_TOKEN: "blob-secret",
  CRON_SECRET: "cron-secret",
  DATABASE_DIRECT_URL: "postgres://direct-secret",
  DATABASE_URL: "postgres://runtime-secret",
  OPERATOR_ACTOR_ID: "operator-1",
  OPERATOR_API_KEY: "operator-secret",
  OPERATOR_ROLE: "owner",
  PII_ENCRYPTION_KEY: "pii-secret",
  VERCEL_ENV: "production",
};

describe("buildProductionHealthReport", () => {
  it("reports production readiness without exposing secret values", () => {
    const report = buildProductionHealthReport({
      now: new Date("2026-05-16T07:30:00.000Z"),
      env: readyEnv,
      database: { ok: true, latencyMs: 42 },
      queue: {
        deadLettered: 0,
        queued: 3,
        retrying: 1,
      },
    });

    expect(report).toMatchObject({
      ok: true,
      generatedAt: "2026-05-16T07:30:00.000Z",
      checks: [
        {
          name: "환경 변수",
          status: "pass",
        },
        {
          name: "데이터베이스",
          status: "pass",
        },
        {
          name: "작업 큐",
          status: "pass",
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("fails closed when required production settings are missing", () => {
    const report = buildProductionHealthReport({
      now: new Date("2026-05-16T07:30:00.000Z"),
      env: {
        ...readyEnv,
        CRON_SECRET: undefined,
        DATABASE_DIRECT_URL: undefined,
      },
      database: { ok: false, latencyMs: null },
      queue: {
        deadLettered: 2,
        queued: 0,
        retrying: 4,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      {
        name: "환경 변수",
        status: "fail",
        message: "필수 설정 2개가 비어 있습니다: DATABASE_DIRECT_URL, CRON_SECRET",
      },
      {
        name: "데이터베이스",
        status: "fail",
        message: "연결 확인에 실패했습니다.",
      },
      {
        name: "작업 큐",
        status: "fail",
        message: "처리 실패 보관함 2건, 재시도 4건",
      },
    ]);
  });
});
