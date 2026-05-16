import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it } from "vitest";
import type { DbClient } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import {
  buildAuthThrottleKey,
  clearAuthAttempts,
  consumeAuthAttempt,
  resolveNextAuthThrottleState,
} from "./auth-throttle";

describe("auth throttle", () => {
  it("builds stable opaque keys without exposing email or IP", () => {
    const key = buildAuthThrottleKey({
      action: "sign-in",
      email: "OWNER@Example.COM",
      ipAddress: "127.0.0.1",
    });

    expect(key).toBe(
      buildAuthThrottleKey({
        action: "sign-in",
        email: "owner@example.com",
        ipAddress: "127.0.0.1",
      }),
    );
    expect(key).toMatch(/^sign-in:[a-f0-9]{64}$/);
    expect(key).not.toContain("owner@example.com");
    expect(key).not.toContain("127.0.0.1");
  });

  it("opens a fresh window when no previous attempts exist", () => {
    const now = new Date("2026-05-16T00:00:00.000Z");

    expect(
      resolveNextAuthThrottleState({
        now,
        record: null,
        limit: 2,
        windowMs: 60_000,
        lockMs: 120_000,
      }),
    ).toMatchObject({
      allowed: true,
      attempts: 1,
      windowStartedAt: now,
      lockedUntil: null,
    });
  });

  it("locks after the configured attempt limit inside a window", () => {
    const now = new Date("2026-05-16T00:00:30.000Z");
    const windowStartedAt = new Date("2026-05-16T00:00:00.000Z");
    const result = resolveNextAuthThrottleState({
      now,
      record: {
        attempts: 2,
        lockedUntil: null,
        windowStartedAt,
      },
      limit: 2,
      windowMs: 60_000,
      lockMs: 120_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.windowStartedAt).toBe(windowStartedAt);
    expect(result.lockedUntil?.toISOString()).toBe("2026-05-16T00:02:30.000Z");
  });

  it("resets after an old window expires", () => {
    const now = new Date("2026-05-16T00:10:00.000Z");

    expect(
      resolveNextAuthThrottleState({
        now,
        record: {
          attempts: 8,
          lockedUntil: null,
          windowStartedAt: new Date("2026-05-16T00:00:00.000Z"),
        },
        limit: 2,
        windowMs: 60_000,
        lockMs: 120_000,
      }),
    ).toMatchObject({
      allowed: true,
      attempts: 1,
      windowStartedAt: now,
      lockedUntil: null,
    });
  });

  const databaseUrl = getPasswordAuthDatabaseUrl();
  const maybeIt = databaseUrl ? it : it.skip;

  maybeIt("serializes concurrent DB attempts before the password hash path", async () => {
    const db = drizzle(neon(databaseUrl!), { schema }) as unknown as DbClient;
    const input = {
      action: "sign-in" as const,
      email: `concurrency-${Date.now()}@example.com`,
      ipAddress: `playwright-${Date.now()}`,
    };

    try {
      await clearAuthAttempts(db, input);
      const results = await Promise.all(
        Array.from({ length: 12 }, () => consumeAuthAttempt(db, input)),
      );

      expect(results.filter((result) => result.ok)).toHaveLength(10);
      expect(results.filter((result) => !result.ok)).toHaveLength(2);
    } finally {
      await clearAuthAttempts(db, input);
    }
  });
});

function getPasswordAuthDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? readDotEnvLocalValue("DATABASE_URL");
}

function readDotEnvLocalValue(name: string): string | null {
  const envPath = `${process.cwd()}/.env.local`;

  if (!existsSync(envPath)) {
    return null;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    return null;
  }

  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^"|"$/g, "");
}
