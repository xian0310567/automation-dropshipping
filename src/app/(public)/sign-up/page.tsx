import { SignUp } from "@clerk/nextjs";
import { getServerEnv } from "@/server/env";
import {
  getClerkReadiness,
  isDevelopmentSessionEnabled,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { startDevelopmentSignup } from "../auth-actions";
import { AuthPanel, PublicShell } from "../public-shell";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const env = getServerEnv();
  const clerkReady = getClerkReadiness(env).ok;

  return (
    <PublicShell eyebrow="회원가입" title="새 운영 워크스페이스 만들기">
      {resolveAuthMode(env) === "clerk" && clerkReady ? (
        <SignUp
          fallbackRedirectUrl="/app/onboarding"
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
        />
      ) : (
        <AuthPanel>
          {isDevelopmentSessionEnabled(env) ? (
            <form action={startDevelopmentSignup} className="space-y-4">
              <input name="next" type="hidden" value="/app/onboarding" />
              <label className="block text-sm font-medium">
                이메일
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
                  defaultValue="owner@example.com"
                  name="email"
                  type="email"
                />
              </label>
              <label className="block text-sm font-medium">
                이름
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
                  defaultValue="대표 운영자"
                  name="name"
                />
              </label>
              <label className="block text-sm font-medium">
                워크스페이스
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
                  defaultValue="Demo Seller"
                  name="tenantName"
                />
              </label>
              <button
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-semibold text-white"
                type="submit"
              >
                워크스페이스 시작
              </button>
            </form>
          ) : (
            <p className="text-sm leading-6 text-zinc-600">
              현재 인증 설정이 완료되지 않았습니다.
            </p>
          )}
        </AuthPanel>
      )}
    </PublicShell>
  );
}
