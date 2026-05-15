import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuthSession } from "@/server/auth/session";

export default async function OnboardingPage() {
  const session = await requireAuthSession("/app/onboarding");

  return (
    <main className="onboarding-screen" data-reference="wxMIN">
      <header className="onboarding-hero">
        <div>
          <p className="ops-eyebrow">{session.tenantName} · 최초 설정</p>
          <h1>연동 준비</h1>
          <p>실제 판매 운영 전에 워크스페이스, 쿠팡, 오너클랜, 알림, 첫 동기화를 준비합니다.</p>
        </div>
        <Button asChild className="ops-primary-button" size="sm">
          <Link href="/app">설정 저장</Link>
        </Button>
      </header>

      <section className="onboarding-grid" aria-label="온보딩 설정">
        <aside className="onboarding-steps" aria-label="설정 단계">
          <h2>설정 단계</h2>
          <StepItem active number="1" title="워크스페이스" detail="판매자 기본 정보 완료" />
          <StepItem warning number="2" title="쿠팡 연동" detail="쿠팡 주문 수집 확인" />
          <StepItem number="3" title="오너클랜" detail="연동 또는 파일 발주 준비" />
          <StepItem number="4" title="알림 설정" detail="위험 알림 기본값" />
        </aside>

        <section className="onboarding-main">
          <article className="onboarding-card onboarding-coupang">
            <h2>쿠팡 연동</h2>
            <p>판매자 ID와 연동 키는 안전하게 보관하고, 주문 수집 가능 여부만 먼저 확인합니다.</p>
            <div className="onboarding-field-grid">
              <label>
                판매자 ID
                <Input defaultValue="A00123456" />
              </label>
              <label>
                연동 키
                <Input defaultValue="••••••••••••••••" readOnly />
              </label>
            </div>
            <Button type="button" className="ops-action tone-amber" size="sm" variant="outline">
              주문 수집 확인
            </Button>
          </article>

          <article className="onboarding-card">
            <h2>오너클랜 준비</h2>
            <p>연동 가능 계정인지 확인 전에는 파일 발주·송장 처리를 기본값으로 둡니다.</p>
            <span className="outline-pill tone-amber">계약 확인 필요</span>
          </article>

          <article className="onboarding-card">
            <h2>알림·확인 기준</h2>
            <p>처음에는 위험 알림과 작업 확인만 켜고, 실제 판매 조치는 운영자가 확인합니다.</p>
            <span className="outline-pill tone-teal">확인 필수</span>
          </article>
        </section>
      </section>
    </main>
  );
}

function StepItem({
  number,
  title,
  detail,
  active,
  warning,
}: {
  number: string;
  title: string;
  detail: string;
  active?: boolean;
  warning?: boolean;
}) {
  return (
    <Button
      type="button"
      className={`onboarding-step ${active ? "is-active" : ""} ${warning ? "is-warning" : ""}`}
      variant="outline"
    >
      <strong>
        {number} {title}
      </strong>
      <span>{detail}</span>
    </Button>
  );
}
