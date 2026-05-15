import { SignIn } from "@clerk/nextjs";
import { getServerEnv } from "@/server/env";
import {
  getClerkReadiness,
  isDevelopmentSessionEnabled,
  normalizeNextPath,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { startDevelopmentSession } from "../auth-actions";
import { AuthPanel, PublicShell } from "../public-shell";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = normalizeNextPath(params.next);
  const env = getServerEnv();
  const clerkReady = getClerkReadiness(env).ok;

  return (
    <PublicShell eyebrow="로그인" title="운영 워크스페이스에 로그인">
      {resolveAuthMode(env) === "clerk" && clerkReady ? (
        <SignIn
          fallbackRedirectUrl={next}
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
        />
      ) : (
        <AuthPanel>
          {isDevelopmentSessionEnabled(env) ? (
            <form action={startDevelopmentSession} className="space-y-4">
              <input name="next" type="hidden" value={next} />
              <label className="block text-sm font-medium">
                이메일
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
                  defaultValue="operator@example.com"
                  name="email"
                  type="email"
                />
              </label>
              <label className="block text-sm font-medium">
                이름
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
                  defaultValue="운영자"
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
                개발 세션으로 로그인
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
