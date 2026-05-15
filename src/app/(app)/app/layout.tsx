import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings, ShieldCheck } from "lucide-react";
import { requireAuthSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthSession("/app");

  if (!session.tenantId) {
    redirect("/app/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link className="flex items-center gap-2" href="/app">
            <ShieldCheck className="text-teal-700" size={20} />
            <span className="text-sm font-semibold">
              {session.tenantName} 운영 워크스페이스
            </span>
          </Link>
          <nav
            aria-label="workspace"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
              {session.membershipRole}
            </span>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-800"
              href="/app/onboarding"
            >
              <Settings size={16} />
              온보딩
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-800"
              href="/logout"
            >
              <LogOut size={16} />
              로그아웃
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
