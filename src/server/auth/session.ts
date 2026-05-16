import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import {
  DEVELOPMENT_SESSION_COOKIE,
  type AuthenticatedSession,
  isDevelopmentSessionEnabled,
  normalizeNextPath,
  parseDevelopmentSessionCookie,
  resolveAuthMode,
  serializeDevelopmentSession,
} from "./session-core";
import {
  PASSWORD_SESSION_COOKIE,
  getPasswordSessionFromToken,
  revokePasswordSession,
} from "./password-store";

export async function getCurrentAuthSession(): Promise<AuthenticatedSession | null> {
  const env = getServerEnv();

  const authMode = resolveAuthMode(env);

  if (authMode === "development") {
    if (!isDevelopmentSessionEnabled(env)) {
      return null;
    }

    const cookieStore = await cookies();
    return parseDevelopmentSessionCookie(
      cookieStore.get(DEVELOPMENT_SESSION_COOKIE)?.value,
    );
  }

  const cookieStore = await cookies();
  const passwordToken = cookieStore.get(PASSWORD_SESSION_COOKIE)?.value;

  if (!passwordToken) {
    return null;
  }

  return getPasswordSessionFromToken(createDb(), passwordToken);
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

export async function setPasswordSessionCookie(input: {
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = Math.max(
    0,
    Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
  );

  cookieStore.set(PASSWORD_SESSION_COOKIE, input.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearDevelopmentSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEVELOPMENT_SESSION_COOKIE);
}

export async function clearAuthSessionCookie(): Promise<void> {
  const env = getServerEnv();
  const cookieStore = await cookies();
  const passwordToken = cookieStore.get(PASSWORD_SESSION_COOKIE)?.value;

  if (resolveAuthMode(env) === "password" && passwordToken) {
    await revokePasswordSession(createDb(), passwordToken);
  }

  cookieStore.delete(PASSWORD_SESSION_COOKIE);
  cookieStore.delete(DEVELOPMENT_SESSION_COOKIE);
}
