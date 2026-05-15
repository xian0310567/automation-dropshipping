"use server";

import { redirect } from "next/navigation";
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

  await setDevelopmentSessionCookie(
    buildDevelopmentSession({
      email,
      name,
      tenantName,
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
