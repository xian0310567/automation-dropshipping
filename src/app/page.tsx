import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="auth-screen landing-screen" data-reference="n9rOC">
      <section className="auth-intro-card">
        <p className="ops-eyebrow">Coupang Ownerclan Ops</p>
        <h1>오늘 처리해야 할 주문·CS·상품 위험을 한 화면에서 봅니다</h1>
        <p>
          위탁판매 운영자가 쿠팡 주문, 오너클랜 발주, 송장, 취소·반품, 상품 재고, 가격 마진을 놓치지 않도록
          확인 흐름을 정리합니다.
        </p>
        <div className="auth-stat-grid">
          <div>
            <span>우선 처리</span>
            <strong>오늘</strong>
          </div>
          <div>
            <span>운영 기준</span>
            <strong>확인 후 실행</strong>
          </div>
        </div>
      </section>

      <section className="auth-form-card">
        <h2>운영 워크스페이스 시작</h2>
        <p>워크스페이스를 만들거나 기존 계정으로 로그인해 오늘 처리 대시보드로 이동합니다.</p>
        <div className="landing-actions">
          <Link href="/sign-up">워크스페이스 만들기</Link>
          <Link href="/sign-in">로그인</Link>
        </div>
      </section>
    </main>
  );
}
