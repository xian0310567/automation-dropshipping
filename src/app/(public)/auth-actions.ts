"use server";

import { redirect } from "next/navigation";
import type { ActorRole } from "@/server/rbac/policy";
import { getServerEnv } from "@/server/env";
import {
  buildDevelopmentSession,
  normalizeNextPath,
} from "@/server/auth/session-core";
import {
  setDevelopmentSessionCookie,
} from "@/server/auth/session";

export async function startDevelopmentSession(formData: FormData) {
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
