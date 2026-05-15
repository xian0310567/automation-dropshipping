import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function PublicShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f6f7f8] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <Link className="flex items-center gap-2 text-sm font-semibold" href="/">
            <ShieldCheck className="text-teal-700" size={20} />
            Coupang Ownerclan Ops
          </Link>
          <nav className="flex items-center gap-2 text-sm" aria-label="public">
            <Link
              className="rounded-md px-3 py-2 font-semibold text-zinc-700"
              href="/sign-in"
            >
              로그인
            </Link>
            <Link
              className="rounded-md bg-zinc-950 px-3 py-2 font-semibold text-white"
              href="/sign-up"
            >
              회원가입
            </Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-8">
        <p className="text-sm font-medium text-teal-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
          {title}
        </h1>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-md rounded-lg border border-zinc-200 bg-white p-5">
      {children}
    </section>
  );
}
