import { z } from "zod";
import type { ActorRole } from "@/server/rbac/policy";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_DIRECT_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  OPERATOR_API_KEY: z.string().optional(),
  OPERATOR_ACTOR_ID: z.string().optional(),
  OPERATOR_ROLE: z
    .enum(["owner", "admin", "operator", "viewer"])
    .default("owner"),
  AUTH_PROVIDER_MODE: z.enum(["development", "clerk"]).default("development"),
  AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: z
    .enum(["true", "false"])
    .default("false"),
  E2E_TEST_MODE: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  COUPANG_VENDOR_ID: z.string().optional(),
  COUPANG_ACCESS_KEY: z.string().optional(),
  COUPANG_SECRET_KEY: z.string().optional(),
  COUPANG_MARKET: z.string().default("KR"),
  OWNERCLAN_API_BASE_URL: z.string().url().optional(),
  OWNERCLAN_ACCESS_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  NOTIFICATION_PROVIDER: z
    .enum(["none", "telegram", "discord", "kakaowork", "email"])
    .default("none"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  PII_ENCRYPTION_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function getServerEnv(input = process.env): ServerEnv {
  return envSchema.parse(input);
}

export function assertMutationEnv(env = getServerEnv()): void {
  assertRequiredEnv(env, [
    "DATABASE_URL",
    "COUPANG_VENDOR_ID",
    "COUPANG_ACCESS_KEY",
    "COUPANG_SECRET_KEY",
    "OPERATOR_API_KEY",
    "OPERATOR_ACTOR_ID",
    "PII_ENCRYPTION_KEY",
  ]);
}

export function assertApprovalEnv(env = getServerEnv()): void {
  assertRequiredEnv(env, ["DATABASE_URL", "PII_ENCRYPTION_KEY"]);
}

export function assertCronEnv(env = getServerEnv()): void {
  assertRequiredEnv(env, ["DATABASE_URL", "CRON_SECRET"]);
}

export function assertUploadEnv(env = getServerEnv()): void {
  assertRequiredEnv(env, ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN"]);
}

export function assertProductionEnv(env = getServerEnv()): void {
  assertRequiredEnv(env, [
    "DATABASE_URL",
    "DATABASE_DIRECT_URL",
    "CRON_SECRET",
    "BLOB_READ_WRITE_TOKEN",
    "PII_ENCRYPTION_KEY",
  ]);

  if (env.AUTH_PROVIDER_MODE === "development") {
    if (env.VERCEL_ENV === "production") {
      if (env.AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION === "true") {
        throw new Error(
          "Development auth sessions are not allowed in public Vercel production",
        );
      }

      return;
    }

    if (env.AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION !== "true") {
      throw new Error(
        "Development auth in production requires AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=true and a non-production Vercel environment",
      );
    }

    return;
  }

  assertRequiredEnv(env, [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ]);

  if (env.AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION === "true") {
    throw new Error("Development auth sessions are not allowed in production");
  }

  if (env.NOTIFICATION_PROVIDER === "telegram") {
    assertRequiredEnv(env, ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
  }

  if (env.NOTIFICATION_PROVIDER === "discord") {
    assertRequiredEnv(env, ["DISCORD_WEBHOOK_URL"]);
  }
}

export function getOperatorRole(env = getServerEnv()): ActorRole {
  return env.OPERATOR_ROLE;
}

export function shouldRunProductionPreflight(
  env: Partial<
    Pick<NodeJS.ProcessEnv, "NODE_ENV" | "NEXT_PHASE" | "E2E_TEST_MODE">
  > = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" &&
    env.NEXT_PHASE !== "phase-production-build" &&
    env.E2E_TEST_MODE !== "true"
  );
}

function assertRequiredEnv(
  env: ServerEnv,
  keys: readonly (keyof ServerEnv)[],
): void {
  const missing = [
    ...keys.map((key) => [key, env[key]] as const),
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
