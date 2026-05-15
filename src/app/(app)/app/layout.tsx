import { redirect } from "next/navigation";
import { requireAuthSession } from "@/server/auth/session";
import { AppSidebar } from "./app-sidebar";

export const dynamic = "force-dynamic";

const roleLabels = {
  owner: "소유자",
  admin: "관리자",
  operator: "운영자",
  viewer: "읽기 전용",
} as const;

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthSession("/app");

  if (!session.tenantId) {
    redirect("/app/onboarding");
  }

  const roleLabel = roleLabels[session.membershipRole];

  return (
    <div className="app-shell">
      <AppSidebar roleLabel={roleLabel} tenantName={session.tenantName} />
      <div className="app-frame">
        <header className="app-topbar">
          <div>
            <p>쿠팡·오너클랜 위탁판매</p>
            <strong>오늘 처리할 작업을 우선순위대로 확인하세요.</strong>
          </div>
          <div className="app-topbar-actions">
            <span className="app-status-dot">정상 수집</span>
            <a href="/logout">로그아웃</a>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
