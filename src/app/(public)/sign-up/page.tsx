import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { getServerEnv } from "@/server/env";
import {
  getClerkReadiness,
  isDevelopmentSessionEnabled,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { startDevelopmentSignup } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const env = getServerEnv();
  const clerkReady = getClerkReadiness(env).ok;

  return (
    <main className="auth-screen signup-screen" data-reference="ypY4e">
      <section className="signup-form-card" aria-label="워크스페이스 시작">
        <h1>워크스페이스 시작</h1>
        <p>대표 운영자가 판매자 워크스페이스를 만들고, 팀원을 초대해 역할별 권한으로 주문·CS 업무를 나눕니다.</p>
        {resolveAuthMode(env) === "clerk" && clerkReady ? (
          <div className="auth-clerk">
            <SignUp
              fallbackRedirectUrl="/app/onboarding"
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
            />
          </div>
        ) : isDevelopmentSessionEnabled(env) ? (
          <form action={startDevelopmentSignup} className="auth-form">
            <input name="next" type="hidden" value="/app/onboarding" />
            <label>
              이메일
              <input defaultValue="owner@example.com" name="email" type="email" />
            </label>
            <label>
              이름
              <input defaultValue="대표 운영자" name="name" />
            </label>
            <label>
              워크스페이스 이름
              <input defaultValue="Demo Seller" name="tenantName" />
            </label>
            <div className="role-grid" aria-label="역할 선택">
              <button className="is-active" type="button">
                <strong>소유자</strong>
                <span>연동·알림 관리</span>
              </button>
              <button type="button">
                <strong>운영자</strong>
                <span>승인·CS 처리</span>
              </button>
            </div>
            <button type="submit">온보딩 시작</button>
          </form>
        ) : (
          <p className="auth-muted">현재 인증 설정이 완료되지 않았습니다.</p>
        )}
      </section>

      <aside className="signup-steps-card" aria-label="가입 후 필요한 세 가지">
        <h2>가입 후 바로 필요한 세 가지</h2>
        <article>
          <h3>1. 판매자 프로필</h3>
          <p>쿠팡 벤더 ID와 운영 지역, 담당자 연락 채널을 먼저 고정합니다.</p>
        </article>
        <article>
          <h3>2. 연동 준비</h3>
          <p>쿠팡 주문 수집, 오너클랜 발주 방식, 파일 처리 범위를 확인합니다.</p>
        </article>
        <article>
          <h3>3. 알림·확인 기준</h3>
          <p>발주, 송장, CS 답변, 반품은 확인 흐름으로 시작합니다.</p>
        </article>
        <Link href="/sign-in">이미 워크스페이스가 있나요?</Link>
      </aside>
    </main>
  );
}
