import { createHash } from "crypto";
import { z } from "zod";
import type { ActorRole } from "@/server/rbac/policy";

export const DEVELOPMENT_SESSION_COOKIE = "oc_dev_session";

export type AuthProviderMode = "development" | "clerk";

export type AuthenticatedSession = {
  authProvider: AuthProviderMode;
  authSubjectId: string;
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  membershipRole: ActorRole;
  issuedAt: string;
};

type AuthEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  AUTH_PROVIDER_MODE?: string;
  AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

const actorRoleSchema = z.enum(["owner", "admin", "operator", "viewer"]);

const sessionSchema = z.object({
  authProvider: z.enum(["development", "clerk"]),
  authSubjectId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  tenantSlug: z.string().min(1),
  membershipRole: actorRoleSchema,
  issuedAt: z.string().datetime(),
});

export function resolveAuthMode(env: AuthEnv): AuthProviderMode {
  return env.AUTH_PROVIDER_MODE === "clerk" ? "clerk" : "development";
}

export function isDevelopmentSessionEnabled(env: AuthEnv): boolean {
  return (
    resolveAuthMode(env) === "development" &&
    (env.NODE_ENV !== "production" ||
      (env.AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION === "true" &&
        env.VERCEL_ENV !== "production"))
  );
}

export function getClerkReadiness(env: AuthEnv): {
  ok: boolean;
  missing: string[];
} {
  const missing = [
    [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ],
    ["CLERK_SECRET_KEY", env.CLERK_SECRET_KEY],
  ] as const;

  const missingKeys = missing
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    ok: missingKeys.length === 0,
    missing: [...missingKeys],
  };
}

export function buildDevelopmentSession(input: {
  email: string;
  name: string;
  tenantName: string;
  role?: ActorRole;
  issuedAt?: Date;
}): AuthenticatedSession {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const tenantName = input.tenantName.trim();
  const tenantSlug = slugifyTenantName(tenantName);

  return {
    authProvider: "development",
    authSubjectId: `dev:${email}`,
    userId: buildStableScopedUuid("dev-user", email),
    email,
    name,
    tenantId: buildStableScopedUuid("dev-tenant", tenantSlug),
    tenantName,
    tenantSlug,
    membershipRole: input.role ?? "owner",
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
  };
}

export function serializeDevelopmentSession(
  session: AuthenticatedSession,
): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function parseDevelopmentSessionCookie(
  value?: string | null,
): AuthenticatedSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    return sessionSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function normalizeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/app",
): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }

  if (value.startsWith("//") || value.includes("://")) {
    return fallback;
  }

  return value;
}

export function mapClerkOrganizationRole(
  role: string | null | undefined,
): ActorRole | null {
  if (role === "org:owner" || role === "owner") {
    return "owner";
  }

  if (role === "org:admin" || role === "admin") {
    return "admin";
  }

  if (role === "org:member" || role === "operator") {
    return "operator";
  }

  if (role === "viewer") {
    return "viewer";
  }

  return null;
}

export function buildStableScopedUuid(scope: string, value: string): string {
  const hex = createHash("sha256").update(`${scope}:${value}`).digest("hex");
  const version = `4${hex.slice(13, 16)}`;
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    version,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function slugifyTenantName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "workspace";
}
