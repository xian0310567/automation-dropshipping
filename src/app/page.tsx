import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";
import { PublicShell } from "./(public)/public-shell";

export default function LandingPage() {
  return (
    <PublicShell
      eyebrow="주문/CS 운영 자동화"
      title="쿠팡 주문, 오너클랜 발주, CS 확인을 한 워크스페이스에서 처리합니다"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4 text-base leading-7 text-zinc-600">
          <p>
            Item Winner 삭제는 별도 서비스가 맡고, 이 서비스는 이후의 매일 반복되는
            주문 확인, 공급사 발주, 송장, 취소/반품 위험, CS 답변 검토를 담당합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white"
              href="/sign-up"
            >
              워크스페이스 만들기
              <ArrowRight size={16} />
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
              href="/sign-in"
            >
              로그인
            </Link>
          </div>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="space-y-4">
            <LandingSignal
              icon={<ClipboardCheck size={18} />}
              title="오늘 처리"
              detail="발주 필요, 송장 대기, 승인 대기 작업을 모읍니다."
            />
            <LandingSignal
              icon={<MessageSquareText size={18} />}
              title="CS 확인"
              detail="상품문의와 고객센터 문의를 SLA 기준으로 정렬합니다."
            />
            <LandingSignal
              icon={<BellRing size={18} />}
              title="운영 경고"
              detail="취소/반품, rate limit, dead letter를 놓치지 않습니다."
            />
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

function LandingSignal({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <article className="flex gap-3">
      <div className="mt-0.5 text-teal-700">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{detail}</p>
      </div>
    </article>
  );
}
