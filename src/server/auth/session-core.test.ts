import { describe, expect, it } from "vitest";
import {
  buildDevelopmentSession,
  isDevelopmentSessionEnabled,
  normalizeNextPath,
  parseDevelopmentSessionCookie,
  resolveAuthMode,
  serializeDevelopmentSession,
} from "./session-core";

describe("session core", () => {
  it("round-trips a deterministic development session", () => {
    const session = buildDevelopmentSession({
      email: "OWNER@EXAMPLE.COM",
      name: "대표 운영자",
      tenantName: "Demo Seller",
      issuedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    expect(session.email).toBe("owner@example.com");
    expect(session.membershipRole).toBe("owner");
    expect(session.userId).toMatch(/[0-9a-f-]{36}/);
    expect(session.tenantId).toMatch(/[0-9a-f-]{36}/);

    expect(parseDevelopmentSessionCookie(serializeDevelopmentSession(session))).toEqual(
      session,
    );
  });

  it("keeps development sessions out of production unless explicitly allowed outside public Vercel production", () => {
    expect(
      isDevelopmentSessionEnabled({
        NODE_ENV: "production",
        AUTH_PROVIDER_MODE: "development",
      }),
    ).toBe(false);
    expect(
      isDevelopmentSessionEnabled({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_PROVIDER_MODE: "development",
        AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: "true",
      }),
    ).toBe(true);
    expect(
      isDevelopmentSessionEnabled({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        AUTH_PROVIDER_MODE: "development",
        AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: "true",
      }),
    ).toBe(false);
  });

  it("normalizes unsafe next paths before redirecting", () => {
    expect(normalizeNextPath("https://evil.example")).toBe("/app");
    expect(normalizeNextPath("//evil.example")).toBe("/app");
    expect(normalizeNextPath("/app/onboarding")).toBe("/app/onboarding");
  });

  it("resolves password auth as the production mode", () => {
    expect(resolveAuthMode({ AUTH_PROVIDER_MODE: "password" })).toBe("password");
    expect(resolveAuthMode({ AUTH_PROVIDER_MODE: "clerk" })).toBe("development");
  });
});
