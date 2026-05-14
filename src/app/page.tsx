import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileUp,
  PackageSearch,
  PauseCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";
import { buildDashboardSummary } from "@/server/dashboard/summary";

export default function Home() {
  const summary = buildDashboardSummary({
    nonWinnerTotal: 1240,
    stopCandidates: 930,
    needsReview: 210,
    excluded: 100,
    newOrders: 12,
    autoOrderCandidates: 9,
    cancelReturnWarnings: 2,
    invoiceWaiting: 7,
    invoiceFailed: 2,
    deadLetters: 1,
    rateLimitedPercent: 21,
  });

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-sm font-medium text-teal-700">오늘의 운영 현황</p>
            <h1 className="mt-2 text-2xl font-semibold leading-8 md:text-3xl">
              쿠팡 × 오너클랜 운영 대시보드
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<FileUp size={18} />} label="비위너 업로드" />
            <ActionButton icon={<Send size={18} />} label="승인 실행" primary />
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary.kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">승인 대기 큐</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  판매중지와 송장 업로드는 승인 후 실행됩니다.
                </p>
              </div>
              <span className="rounded-md bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800">
                {summary.primaryQueue.count}건
              </span>
            </div>
            <div className="grid divide-y divide-zinc-100">
              {approvalRows.map((row) => (
                <QueueRow key={row.title} {...row} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold">작업 상태</h2>
            </div>
            <div className="grid gap-0 divide-y divide-zinc-100 md:grid-cols-3 md:divide-x md:divide-y-0">
              <StatusPanel
                icon={<Clock3 size={20} />}
                label="Cron"
                value="정상"
                detail="다음 실행 01:00 UTC"
              />
              <StatusPanel
                icon={<RotateCcw size={20} />}
                label="Retry"
                value="1건"
                detail="dead letter 전 확인"
              />
              <StatusPanel
                icon={<ShieldCheck size={20} />}
                label="Retention"
                value="대기"
                detail="raw upload 30일 정책"
              />
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-rose-200 bg-white">
            <div className="flex items-center gap-2 border-b border-rose-100 px-5 py-4 text-rose-700">
              <AlertTriangle size={20} />
              <h2 className="text-base font-semibold">긴급 확인</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {summary.urgentItems.map((item) => (
                <div key={item} className="px-5 py-4 text-sm font-medium">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold">Fallback 지표</h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              {fallbackRows.map((row) => (
                <MetricRow key={row.label} {...row} />
              ))}
              {summary.thresholdWarnings.map((warning) => (
                <p
                  key={warning}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                >
                  {warning}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold">연동 준비</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              <ChecklistItem done label="Vercel Cron bearer auth" />
              <ChecklistItem done label="Drizzle schema contracts" />
              <ChecklistItem label="Coupang HMAC smoke test" />
              <ChecklistItem label="Ownerclan API approval" />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ActionButton({
  icon,
  label,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      className={
        primary
          ? "inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white"
          : "inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
      }
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-zinc-700 bg-zinc-100",
    success: "text-teal-800 bg-teal-100",
    warning: "text-amber-800 bg-amber-100",
    danger: "text-rose-800 bg-rose-100",
  }[tone];

  return (
    <article className="min-h-28 rounded-lg border border-zinc-200 bg-white p-5">
      <div className={`inline-flex rounded-md px-2.5 py-1 text-sm ${toneClass}`}>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("ko-KR")}
      </p>
    </article>
  );
}

function QueueRow({
  icon,
  title,
  detail,
  count,
  status,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  count: number;
  status: string;
}) {
  return (
    <article className="grid gap-3 px-5 py-4 md:grid-cols-[32px_1fr_auto_auto] md:items-center">
      <div className="text-zinc-500">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{detail}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{count}건</p>
      <span className="w-fit rounded-md bg-zinc-100 px-2.5 py-1 text-sm text-zinc-700">
        {status}
      </span>
    </article>
  );
}

function StatusPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="p-5">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </article>
  );
}

function MetricRow({
  label,
  value,
  limit,
}: {
  label: string;
  value: string;
  limit: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold">{value}</span>
      <span className="text-zinc-400">{limit}</span>
    </div>
  );
}

function ChecklistItem({ done = false, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 text-sm">
      {done ? (
        <CheckCircle2 className="text-teal-600" size={18} />
      ) : (
        <PauseCircle className="text-amber-600" size={18} />
      )}
      <span>{label}</span>
    </div>
  );
}

const approvalRows = [
  {
    icon: <PackageSearch size={20} />,
    title: "비위너 판매중지 후보",
    detail: "3일 연속 비위너, 최근 주문/클레임 제외",
    count: 930,
    status: "승인 대기",
  },
  {
    icon: <ClipboardCheck size={20} />,
    title: "옵션 매칭 확인",
    detail: "externalVendorSku 또는 ownerclanOptionCode 불일치",
    count: 2,
    status: "검토 필요",
  },
  {
    icon: <Truck size={20} />,
    title: "송장 업로드 실패",
    detail: "택배사 코드 또는 shipmentBoxId 확인",
    count: 2,
    status: "재시도 보류",
  },
];

const fallbackRows = [
  { label: "p95 job runtime", value: "118s", limit: "240s" },
  { label: "cron lag", value: "3m", limit: "15m" },
  { label: "dead letter rate", value: "1.2%", limit: "5%" },
  { label: "Coupang 429", value: "21%", limit: "20%" },
];
