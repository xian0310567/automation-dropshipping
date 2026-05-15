import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/server/env";
import {
  DEVELOPMENT_SESSION_COOKIE,
  type AuthenticatedSession,
  buildStableScopedUuid,
  getClerkReadiness,
  isDevelopmentSessionEnabled,
  mapClerkOrganizationRole,
  normalizeNextPath,
  parseDevelopmentSessionCookie,
  resolveAuthMode,
  serializeDevelopmentSession,
} from "./session-core";

export async function getCurrentAuthSession(): Promise<AuthenticatedSession | null> {
  const env = getServerEnv();

  if (resolveAuthMode(env) === "development") {
    if (!isDevelopmentSessionEnabled(env)) {
      return null;
    }

    const cookieStore = await cookies();
    return parseDevelopmentSessionCookie(
      cookieStore.get(DEVELOPMENT_SESSION_COOKIE)?.value,
    );
  }

  return getClerkAuthSession(env);
}

export async function requireAuthSession(
  nextPath: string | null | undefined = "/app",
): Promise<AuthenticatedSession> {
  const session = await getCurrentAuthSession();

  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(normalizeNextPath(nextPath))}`);
  }

  return session;
}

export async function setDevelopmentSessionCookie(
  session: AuthenticatedSession,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEVELOPMENT_SESSION_COOKIE, serializeDevelopmentSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDevelopmentSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEVELOPMENT_SESSION_COOKIE);
}

async function getClerkAuthSession(env: ReturnType<typeof getServerEnv>) {
  const readiness = getClerkReadiness(env);

  if (!readiness.ok) {
    return null;
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const authState = await auth();

  if (!authState.isAuthenticated || !authState.userId) {
    return null;
  }

  const user = await currentUser().catch(() => null);
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses.at(0)?.emailAddress ??
    `${authState.userId}@clerk.local`;
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    email;
  if (!authState.orgId) {
    return null;
  }

  const membershipRole = mapClerkOrganizationRole(authState.orgRole);

  if (!membershipRole) {
    return null;
  }

  const tenantId = buildStableScopedUuid("clerk-tenant", authState.orgId);
  const tenantSlug = authState.orgSlug ?? authState.orgId;

  return {
    authProvider: "clerk" as const,
    authSubjectId: authState.userId,
    userId: buildStableScopedUuid("clerk-user", authState.userId),
    email,
    name,
    tenantId,
    tenantName: authState.orgSlug ?? authState.orgId,
    tenantSlug,
    membershipRole,
    issuedAt: new Date().toISOString(),
  };
}
