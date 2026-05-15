import { CheckCircle2, KeyRound, Store, UsersRound } from "lucide-react";
import { requireAuthSession } from "@/server/auth/session";

export default async function OnboardingPage() {
  const session = await requireAuthSession("/app/onboarding");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-teal-700">워크스페이스 설정</p>
        <h1 className="mt-2 text-2xl font-semibold">SaaS 온보딩</h1>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <SetupItem
          icon={<Store size={20} />}
          status="완료"
          title={session.tenantName}
          detail="운영 워크스페이스가 세션 멤버십으로 보호됩니다."
        />
        <SetupItem
          icon={<UsersRound size={20} />}
          status="다음"
          title="멤버 초대"
          detail="owner, admin, operator, viewer 역할로 초대합니다."
        />
        <SetupItem
          icon={<KeyRound size={20} />}
          status="대기"
          title="쿠팡 연동"
          detail="tenant별 암호화 credential 저장소에 연결됩니다."
        />
        <SetupItem
          icon={<CheckCircle2 size={20} />}
          status="대기"
          title="오너클랜 준비도"
          detail="API 가능 여부와 CSV fallback 한계를 확인합니다."
        />
      </section>
    </main>
  );
}

function SetupItem({
  icon,
  status,
  title,
  detail,
}: {
  icon: React.ReactNode;
  status: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="min-h-36 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-teal-700">{icon}</div>
        <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-700">
          {status}
        </span>
      </div>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
    </article>
  );
}
