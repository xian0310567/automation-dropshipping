import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import type { DbClient } from "@/server/db/client";
import { authRateLimits } from "@/server/db/schema";
import { normalizeAuthEmail } from "./password-core";

export type AuthThrottleAction = "sign-in" | "sign-up";

type AuthThrottlePolicy = {
  limit: number;
  windowMs: number;
  lockMs: number;
};

type AuthThrottleRecord = {
  attempts: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

export type AuthThrottleResult =
  | { ok: true }
  | {
      ok: false;
      code: "rate_limited";
      message: string;
      retryAt: Date;
    };

const policies: Record<AuthThrottleAction, AuthThrottlePolicy> = {
  "sign-in": {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    lockMs: 10 * 60 * 1000,
  },
  "sign-up": {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    lockMs: 30 * 60 * 1000,
  },
};

export async function consumeAuthAttempt(
  db: DbClient,
  input: {
    action: AuthThrottleAction;
    email?: string;
    ipAddress: string;
  },
): Promise<AuthThrottleResult> {
  const key = buildAuthThrottleKey(input);
  const policy = policies[input.action];
  const now = new Date();
  const windowResetBefore = new Date(now.getTime() - policy.windowMs);
  const lockedUntil = new Date(now.getTime() + policy.lockMs);
  const result = (await db.execute(sql`
    insert into auth_rate_limits as current_limit
      (key, action, attempts, window_started_at, locked_until, updated_at)
    values (${key}, ${input.action}, 1, ${now}, null, ${now})
    on conflict (key) do update set
      attempts = case
        when current_limit.locked_until is not null
          and current_limit.locked_until > ${now}
          then current_limit.attempts
        when current_limit.window_started_at < ${windowResetBefore}
          then 1
        else current_limit.attempts + 1
      end,
      window_started_at = case
        when current_limit.locked_until is not null
          and current_limit.locked_until > ${now}
          then current_limit.window_started_at
        when current_limit.window_started_at < ${windowResetBefore}
          then ${now}
        else current_limit.window_started_at
      end,
      locked_until = case
        when current_limit.locked_until is not null
          and current_limit.locked_until > ${now}
          then current_limit.locked_until
        when current_limit.window_started_at < ${windowResetBefore}
          then null
        when current_limit.attempts + 1 > ${policy.limit}
          then ${lockedUntil}
        else null
      end,
      updated_at = ${now}
    returning attempts, window_started_at, locked_until
  `)) as {
    rows: {
      attempts: number;
      window_started_at: Date | string;
      locked_until: Date | string | null;
    }[];
  };
  const row = result.rows[0];

  if (!row) {
    return { ok: true };
  }

  const returnedLockedUntil = row.locked_until
    ? new Date(row.locked_until)
    : null;

  if (returnedLockedUntil && returnedLockedUntil > now) {
    return {
      ok: false,
      code: "rate_limited",
      message: "요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.",
      retryAt: returnedLockedUntil,
    };
  }

  return { ok: true };
}

export async function clearAuthAttempts(
  db: DbClient,
  input: {
    action: AuthThrottleAction;
    email?: string;
    ipAddress: string;
  },
): Promise<void> {
  await db
    .delete(authRateLimits)
    .where(eq(authRateLimits.key, buildAuthThrottleKey(input)));
}

export function buildAuthThrottleKey(input: {
  action: AuthThrottleAction;
  email?: string;
  ipAddress: string;
}): string {
  const normalizedEmail = input.email
    ? normalizeAuthEmail(input.email) ?? input.email.trim().toLowerCase()
    : "no-email";
  const digest = createHash("sha256")
    .update(`${input.action}:${input.ipAddress}:${normalizedEmail}`)
    .digest("hex");

  return `${input.action}:${digest}`;
}

export function resolveNextAuthThrottleState(input: {
  now: Date;
  record: AuthThrottleRecord | null;
  limit: number;
  windowMs: number;
  lockMs: number;
}): {
  allowed: boolean;
  attempts: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
} {
  if (input.record?.lockedUntil && input.record.lockedUntil > input.now) {
    return {
      allowed: false,
      attempts: input.record.attempts,
      windowStartedAt: input.record.windowStartedAt,
      lockedUntil: input.record.lockedUntil,
    };
  }

  if (
    !input.record ||
    input.now.getTime() - input.record.windowStartedAt.getTime() > input.windowMs
  ) {
    return {
      allowed: true,
      attempts: 1,
      windowStartedAt: input.now,
      lockedUntil: null,
    };
  }

  const attempts = input.record.attempts + 1;
  const lockedUntil =
    attempts > input.limit
      ? new Date(input.now.getTime() + input.lockMs)
      : null;

  return {
    allowed: !lockedUntil,
    attempts,
    windowStartedAt: input.record.windowStartedAt,
    lockedUntil,
  };
}
