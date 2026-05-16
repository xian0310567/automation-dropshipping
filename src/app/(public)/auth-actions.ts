"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ActorRole } from "@/server/rbac/policy";
import { createDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import {
  buildDevelopmentSession,
  isDevelopmentSessionEnabled,
  normalizeNextPath,
} from "@/server/auth/session-core";
import {
  setDevelopmentSessionCookie,
  setPasswordSessionCookie,
} from "@/server/auth/session";
import {
  clearAuthAttempts,
  consumeAuthAttempt,
  type AuthThrottleResult,
} from "@/server/auth/auth-throttle";
import {
  authenticatePassword,
  createPasswordAccount,
  type PasswordAuthFailure,
} from "@/server/auth/password-store";

export async function signInWithPassword(formData: FormData) {
  const db = createDb();
  const next = normalizeNextPath(formData.get("next"));
  const email = String(formData.get("email") ?? "");
  const ipAddress = await getRequestIpAddress();
  const ipThrottle = await consumeAuthAttempt(db, {
    action: "sign-in",
    ipAddress,
  });

  if (!ipThrottle.ok) {
    redirect(buildAuthRedirect("/sign-in", next, ipThrottle));
  }

  const throttle = await consumeAuthAttempt(db, {
    action: "sign-in",
    email,
    ipAddress,
  });

  if (!throttle.ok) {
    redirect(buildAuthRedirect("/sign-in", next, throttle));
  }

  const result = await authenticatePassword(db, {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect(buildAuthRedirect("/sign-in", next, result));
  }

  await clearAuthAttempts(db, {
    action: "sign-in",
    email,
    ipAddress,
  });

  await setPasswordSessionCookie({
    token: result.token,
    expiresAt: result.expiresAt,
  });

  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  const db = createDb();
  const next = normalizeNextPath(formData.get("next"), "/app/onboarding");
  const ipAddress = await getRequestIpAddress();
  const throttle = await consumeAuthAttempt(db, {
    action: "sign-up",
    ipAddress,
  });

  if (!throttle.ok) {
    redirect(buildAuthRedirect("/sign-up", next, throttle));
  }

  const result = await createPasswordAccount(db, {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    tenantName: String(formData.get("tenantName") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    redirect(buildAuthRedirect("/sign-up", next, result));
  }

  await setPasswordSessionCookie({
    token: result.token,
    expiresAt: result.expiresAt,
  });

  redirect(next);
}

export async function startDevelopmentSession(formData: FormData) {
  if (!isDevelopmentSessionEnabled(getServerEnv())) {
    redirect("/sign-in?error=auth_not_configured");
  }

  const email = String(formData.get("email") ?? "operator@example.com").trim();
  const name = String(formData.get("name") ?? "운영자").trim() || "운영자";
  const tenantName =
    String(formData.get("tenantName") ?? "Demo Seller").trim() || "Demo Seller";
  const next = normalizeNextPath(formData.get("next"));
  const role = resolveDevelopmentRole(formData.get("role"));

  await setDevelopmentSessionCookie(
    buildDevelopmentSession({
      email,
      name,
      tenantName,
      role,
    }),
  );

  redirect(next);
}

export async function startDevelopmentSignup(formData: FormData) {
  const next = normalizeNextPath(formData.get("next"), "/app/onboarding");
  const signupData = new FormData();

  signupData.set(
    "email",
    String(formData.get("email") ?? "operator@example.com"),
  );
  signupData.set("name", String(formData.get("name") ?? "운영자"));
  signupData.set(
    "tenantName",
    String(formData.get("tenantName") ?? "Demo Seller"),
  );
  signupData.set("next", next);

  await startDevelopmentSession(signupData);
}

function resolveDevelopmentRole(value: FormDataEntryValue | null): ActorRole | undefined {
  if (getServerEnv().E2E_TEST_MODE !== "true" || typeof value !== "string") {
    return undefined;
  }

  if (
    value === "owner" ||
    value === "admin" ||
    value === "operator" ||
    value === "viewer"
  ) {
    return value;
  }

  return undefined;
}

function buildAuthRedirect(
  path: "/sign-in" | "/sign-up",
  next: string,
  error: PasswordAuthFailure | Extract<AuthThrottleResult, { ok: false }>,
): string {
  const params = new URLSearchParams({
    next,
    error: error.code,
  });

  return `${path}?${params.toString()}`;
}

async function getRequestIpAddress(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local";
}
