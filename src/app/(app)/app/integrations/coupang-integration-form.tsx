"use client";

import { useActionState, type ComponentProps } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Unplug,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CoupangSyncJobSummary } from "@/server/coupang/sync-jobs";
import type { CoupangIntegrationSummary } from "@/server/integrations/coupang-credentials";
import type { CoupangIntegrationFormState } from "./actions";
import {
  disconnectCoupangIntegrationAction,
  saveCoupangIntegrationAction,
} from "./actions";

const cardMotion = {
  initial: { y: 8 },
  animate: { y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
} as const;

type CoupangIntegrationFormProps = {
  summary: CoupangIntegrationSummary;
  syncSummary: CoupangSyncJobSummary;
};

type FieldProps = {
  error?: string;
  label: string;
  name: string;
  type?: string;
} & Omit<ComponentProps<typeof Input>, "name" | "type">;

const initialCoupangIntegrationFormState: CoupangIntegrationFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function CoupangIntegrationForm({
  summary,
  syncSummary,
}: CoupangIntegrationFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveCoupangIntegrationAction,
    initialCoupangIntegrationFormState,
  );
  const isConnected = summary.status === "connected";
  const statusLabel = isConnected ? "연결됨" : "연결 필요";
  const smokeLabel =
    summary.lastSmokeTestStatus === "signature_ready" ? "서명 준비 완료" : "저장 전";

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]" aria-label="쿠팡 연동 설정">
      <motion.div {...cardMotion} data-motion="coupang-form-card">
        <Card className="ops-card">
          <CardHeader className="border-b">
            <CardTitle aria-level={2} className="flex items-center gap-2" role="heading">
              <PlugZap className="size-4" aria-hidden="true" />
              쿠팡 WING Open API
            </CardTitle>
            <CardDescription>
              WING에서 발급한 판매자 ID와 키를 입력하면 이 워크스페이스에만 연결됩니다.
            </CardDescription>
            <CardAction>
              <Badge variant={isConnected ? "secondary" : "outline"}>{statusLabel}</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="grid gap-4 py-4">
            <form action={formAction} className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  error={state.fieldErrors?.vendorId}
                  label="판매자 ID"
                  name="vendorId"
                  placeholder="A00123456"
                />
                <Field
                  error={state.fieldErrors?.displayName}
                  label="연동 이름"
                  name="displayName"
                  placeholder="본점 쿠팡"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  autoComplete="off"
                  error={state.fieldErrors?.accessKey}
                  label="Access Key"
                  name="accessKey"
                  placeholder="WING에서 발급한 Access Key"
                />
                <Field
                  autoComplete="new-password"
                  error={state.fieldErrors?.secretKey}
                  label="Secret Key"
                  name="secretKey"
                  placeholder="저장 후 다시 표시되지 않습니다"
                  type="password"
                />
              </div>

              {state.message ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    state.status === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                  role={state.status === "error" ? "alert" : "status"}
                >
                  {state.message}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="ops-primary-button"
                  disabled={!summary.canManage || isPending}
                  size="sm"
                  type="submit"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  )}
                  쿠팡 연결 저장
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="https://wing.coupang.com" rel="noreferrer" target="_blank">
                    <KeyRound className="size-4" aria-hidden="true" />
                    WING에서 키 확인
                  </a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.aside {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.04 }} data-motion="coupang-status-card">
        <Card className="ops-card">
          <CardHeader className="border-b">
            <CardTitle aria-level={2} role="heading">
              연동 상태
            </CardTitle>
            <CardDescription>키는 저장 후 다시 표시하지 않고, 필요한 상태만 보여줍니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 py-4">
            <StatusRow label="상태" value={statusLabel} strong={isConnected} />
            <StatusRow label="판매자 ID" value={summary.maskedVendorId ?? "미입력"} />
            <StatusRow label="확인" value={smokeLabel} />
            <StatusRow label="최근 저장" value={formatKoreanDateTime(summary.credentialLastRotatedAt)} />

            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
              현재는 쿠팡만 연결합니다. 네이버 스마트스토어는 다음 연동 단계에서 같은 방식으로 추가합니다.
            </div>

            <CoupangSyncStatus summary={syncSummary} />

            {!summary.canManage ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                연동 변경은 소유자 또는 관리자만 할 수 있습니다.
              </p>
            ) : null}

            <form action={disconnectCoupangIntegrationAction}>
              <Button disabled={!summary.canManage || !isConnected} size="sm" type="submit" variant="outline">
                <Unplug className="size-4" aria-hidden="true" />
                쿠팡 연결 해제
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.aside>
    </section>
  );
}

function CoupangSyncStatus({ summary }: { summary: CoupangSyncJobSummary }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-teal-700" aria-hidden="true" />
            동기화 작업
          </h3>
          <p className="text-xs text-muted-foreground">{summary.headline}</p>
        </div>
      </div>

      <div className="grid gap-2">
        {summary.items.map((item) => (
          <div
            className="flex items-center justify-between gap-3 text-sm"
            key={item.type}
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className={getSyncStatusClassName(item.tone)}>
              {item.statusLabel}
            </span>
          </div>
        ))}
      </div>

      {summary.latestIssue ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
          {summary.latestIssue}
        </p>
      ) : null}
    </div>
  );
}

function getSyncStatusClassName(
  tone: CoupangSyncJobSummary["items"][number]["tone"],
): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold";

  if (tone === "success") {
    return `${base} bg-emerald-50 text-emerald-700`;
  }

  if (tone === "warning") {
    return `${base} bg-amber-50 text-amber-800`;
  }

  if (tone === "danger") {
    return `${base} bg-red-50 text-red-700`;
  }

  return `${base} bg-background text-muted-foreground`;
}

function Field({ error, label, name, type = "text", ...props }: FieldProps) {
  const errorId = `${name}-error`;

  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        name={name}
        type={type}
        {...props}
      />
      {error ? (
        <span className="text-xs font-normal text-destructive" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function StatusRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 text-sm ${strong ? "font-semibold" : ""}`}>
        {strong ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : null}
        {value}
      </span>
    </div>
  );
}

function formatKoreanDateTime(value: string | null): string {
  if (!value) {
    return "아직 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
