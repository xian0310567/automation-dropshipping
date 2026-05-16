import Link from "next/link";
import { getServerEnv } from "@/server/env";
import {
  isDevelopmentSessionEnabled,
  resolveAuthMode,
} from "@/server/auth/session-core";
import { signUpWithPassword, startDevelopmentSignup } from "../auth-actions";

export const dynamic = "force-dynamic";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const env = getServerEnv();
  const authMode = resolveAuthMode(env);
  const errorMessage = getAuthErrorMessage(params.error);

  return (
    <main className="auth-screen signup-screen" data-reference="ypY4e">
      <section className="signup-form-card" aria-label="워크스페이스 시작">
        <h1>워크스페이스 시작</h1>
        <p>대표 운영자가 판매자 워크스페이스를 만들고, 팀원을 초대해 역할별 권한으로 주문·CS 업무를 나눕니다.</p>
        {authMode === "password" ? (
          <form action={signUpWithPassword} className="auth-form">
            <input name="next" type="hidden" value="/app/onboarding" />
            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <label>
              이메일
              <input
                autoComplete="email"
                name="email"
                placeholder="owner@example.com"
                required
                type="email"
              />
            </label>
            <label>
              이름
              <input
                autoComplete="name"
                name="name"
                placeholder="대표 운영자"
                required
              />
            </label>
            <label>
              워크스페이스 이름
              <input
                autoComplete="organization"
                name="tenantName"
                placeholder="내 스토어"
                required
              />
            </label>
            <label>
              비밀번호
              <input
                autoComplete="new-password"
                minLength={10}
                name="password"
                placeholder="영문과 숫자 포함 10자 이상"
                required
                type="password"
              />
            </label>
            <button type="submit">온보딩 시작</button>
          </form>
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

function getAuthErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_email") {
    return "사용 가능한 이메일을 입력해주세요.";
  }

  if (error === "weak_password") {
    return "비밀번호는 10자 이상이며 영문자와 숫자를 모두 포함해야 합니다.";
  }

  if (error === "email_taken") {
    return "이미 가입된 이메일입니다. 로그인해주세요.";
  }

  if (error === "invalid_workspace") {
    return "워크스페이스 이름을 입력해주세요.";
  }

  if (error === "rate_limited") {
    return "요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.";
  }

  return null;
}
