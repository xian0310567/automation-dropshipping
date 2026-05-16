import { getServerEnv } from "@/server/env";
import {
  isDevelopmentSessionEnabled,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { startDevelopmentSignup } from "../../auth-actions";
import { AuthPanel, PublicShell } from "../../public-shell";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const env = getServerEnv();
  const usePasswordAuth = resolveAuthMode(env) === "password";
  const signupAction =
    !usePasswordAuth && isDevelopmentSessionEnabled(env)
      ? startDevelopmentSignup
      : null;

  return (
    <PublicShell eyebrow="초대 수락" title="초대받은 워크스페이스에 참여">
      <AuthPanel>
        {signupAction ? (
        <form action={signupAction} className="space-y-4">
          <input name="inviteToken" type="hidden" value={token} />
          <input name="next" type="hidden" value="/app/onboarding" />
          <label className="block text-sm font-medium">
            이메일
            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
              defaultValue="invited@example.com"
              name="email"
              type="email"
            />
          </label>
          <label className="block text-sm font-medium">
            이름
            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
              defaultValue="초대 사용자"
              name="name"
            />
          </label>
          <label className="block text-sm font-medium">
            워크스페이스
            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3"
              defaultValue="Invited Seller"
              name="tenantName"
            />
          </label>
          <button
            className="h-10 w-full rounded-md bg-zinc-950 text-sm font-semibold text-white"
            type="submit"
          >
            초대 수락
          </button>
        </form>
        ) : (
          <p className="auth-muted">
            초대 수락은 계정 관리 기능과 함께 열릴 예정입니다. 지금은 워크스페이스
            만들기에서 직접 시작해주세요.
          </p>
        )}
      </AuthPanel>
    </PublicShell>
  );
}
