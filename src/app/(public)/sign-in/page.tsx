import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { getServerEnv } from "@/server/env";
import {
  getClerkReadiness,
  isDevelopmentSessionEnabled,
  normalizeNextPath,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { startDevelopmentSession } from "../auth-actions";

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
    <main className="auth-screen" data-reference="YA9gq">
      <section className="auth-intro-card" aria-label="서비스 소개">
        <p className="ops-eyebrow">Coupang Ownerclan Ops</p>
        <h1>주문과 CS를 안전하게 처리하는 운영 워크스페이스</h1>
        <p>
          쿠팡 주문, 오너클랜 발주, 송장, 취소/반품 위험, CS 답변 초안을 한 화면에서 확인하고 필요한 작업을
          진행합니다.
        </p>
        <div className="auth-stat-grid" aria-label="오늘 운영 요약">
          <div>
            <span>오늘 승인 대기</span>
            <strong>210건</strong>
          </div>
          <div>
            <span>SLA 위험</span>
            <strong className="danger">18건</strong>
          </div>
        </div>
        <ul className="auth-checklist">
          <li>워크스페이스별 쿠팡·오너클랜 자격 증명 분리</li>
          <li>고객 영향 작업은 확인 후 실행</li>
          <li>개인정보는 필요한 범위만 마스킹해 표시</li>
        </ul>
      </section>

      <section className="auth-form-card" aria-label="로그인">
        <h2>운영 워크스페이스에 로그인</h2>
        <p>작업자 계정과 워크스페이스를 확인한 뒤 보호된 대시보드로 이동합니다.</p>
        {resolveAuthMode(env) === "clerk" && clerkReady ? (
          <div className="auth-clerk">
            <SignIn
              fallbackRedirectUrl={next}
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
            />
          </div>
        ) : isDevelopmentSessionEnabled(env) ? (
          <form action={startDevelopmentSession} className="auth-form">
            <input name="next" type="hidden" value={next} />
            <label>
              이메일
              <input defaultValue="operator@example.com" name="email" type="email" />
            </label>
            <label>
              워크스페이스
              <input defaultValue="Demo Seller" name="tenantName" />
            </label>
            <input name="name" type="hidden" value="운영자" />
            <button type="submit">대시보드로 이동</button>
          </form>
        ) : (
          <p className="auth-muted">현재 인증 설정이 완료되지 않았습니다.</p>
        )}
        <p className="auth-note">
          초대를 받았다면 초대 링크에서 같은 계정으로 시작할 수 있습니다.{" "}
          <Link href="/sign-up">워크스페이스 만들기</Link>
        </p>
      </section>
    </main>
  );
}
