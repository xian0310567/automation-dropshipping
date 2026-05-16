export type ProductionHealthEnv = {
  AUTH_PROVIDER_MODE?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  CRON_SECRET?: string;
  DATABASE_DIRECT_URL?: string;
  DATABASE_URL?: string;
  OPERATOR_ACTOR_ID?: string;
  OPERATOR_API_KEY?: string;
  OPERATOR_ROLE?: string;
  PII_ENCRYPTION_KEY?: string;
  VERCEL_ENV?: string;
};

export type ProductionHealthReport = {
  ok: boolean;
  generatedAt: string;
  checks: ProductionHealthCheck[];
};

export type ProductionHealthCheck = {
  name: "환경 변수" | "데이터베이스" | "작업 큐";
  status: "pass" | "fail";
  message: string;
};

const requiredProductionEnv: (keyof ProductionHealthEnv)[] = [
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "CRON_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "PII_ENCRYPTION_KEY",
  "OPERATOR_API_KEY",
  "OPERATOR_ACTOR_ID",
  "OPERATOR_ROLE",
];

export function buildProductionHealthReport(input: {
  now?: Date;
  env: ProductionHealthEnv;
  database: {
    ok: boolean;
    latencyMs: number | null;
  };
  queue: {
    queued: number;
    retrying: number;
    deadLettered: number;
  };
}): ProductionHealthReport {
  const checks = [
    buildEnvCheck(input.env),
    buildDatabaseCheck(input.database),
    buildQueueCheck(input.queue),
  ];

  return {
    ok: checks.every((check) => check.status === "pass"),
    generatedAt: (input.now ?? new Date()).toISOString(),
    checks,
  };
}

function buildEnvCheck(env: ProductionHealthEnv): ProductionHealthCheck {
  const missing = requiredProductionEnv.filter((key) => !env[key]);

  if (missing.length > 0) {
    return {
      name: "환경 변수",
      status: "fail",
      message: `필수 설정 ${missing.length}개가 비어 있습니다: ${missing.join(", ")}`,
    };
  }

  if (
    env.VERCEL_ENV === "production" &&
    env.AUTH_PROVIDER_MODE === "development"
  ) {
    return {
      name: "환경 변수",
      status: "fail",
      message: "운영 배포에서는 비밀번호 로그인을 사용해야 합니다.",
    };
  }

  return {
    name: "환경 변수",
    status: "pass",
    message: "운영 필수 값이 준비되었습니다.",
  };
}

function buildDatabaseCheck(input: {
  ok: boolean;
  latencyMs: number | null;
}): ProductionHealthCheck {
  if (!input.ok) {
    return {
      name: "데이터베이스",
      status: "fail",
      message: "연결 확인에 실패했습니다.",
    };
  }

  return {
    name: "데이터베이스",
    status: "pass",
    message:
      typeof input.latencyMs === "number"
        ? `연결 확인 완료 (${input.latencyMs}ms)`
        : "연결 확인 완료",
  };
}

function buildQueueCheck(input: {
  queued: number;
  retrying: number;
  deadLettered: number;
}): ProductionHealthCheck {
  if (input.deadLettered > 0) {
    return {
      name: "작업 큐",
      status: "fail",
      message: `처리 실패 보관함 ${input.deadLettered}건, 재시도 ${input.retrying}건`,
    };
  }

  return {
    name: "작업 큐",
    status: "pass",
    message: `대기 ${input.queued}건, 재시도 ${input.retrying}건`,
  };
}
