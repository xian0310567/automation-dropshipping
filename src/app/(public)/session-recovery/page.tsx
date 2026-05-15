import Link from "next/link";
import { AuthPanel, PublicShell } from "../public-shell";

export default function SessionRecoveryPage() {
  return (
    <PublicShell eyebrow="세션 복구" title="로그인 상태를 다시 확인">
      <AuthPanel>
        <div className="space-y-4 text-sm leading-6 text-zinc-600">
          <p>세션이 만료되었거나 브라우저 쿠키가 초기화되었습니다.</p>
          <Link
            className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 font-semibold text-white"
            href="/sign-in"
          >
            다시 로그인
          </Link>
        </div>
      </AuthPanel>
    </PublicShell>
  );
}
