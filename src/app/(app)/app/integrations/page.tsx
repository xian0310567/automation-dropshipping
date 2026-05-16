import { ensureLocalIdentityForSession } from "@/server/auth/local-identity";
import { requireAuthSession } from "@/server/auth/session";
import {
  getCoupangSyncJobSummary,
  summarizeCoupangSyncJobs,
  type CoupangSyncJobSummary,
} from "@/server/coupang/sync-jobs";
import type { AuthenticatedSession } from "@/server/auth/session-core";
import { createDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { getE2eCoupangIntegrationSummary } from "@/server/integrations/e2e-coupang-store";
import {
  buildDefaultCoupangSummary,
  getCoupangIntegrationSummary,
  type CoupangIntegrationSummary,
} from "@/server/integrations/coupang-credentials";
import { buildTenantContext } from "@/server/tenancy/context";
import { CoupangIntegrationForm } from "./coupang-integration-form";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireAuthSession("/app/integrations");
  const data = await loadCoupangIntegrationData(session);

  return (
    <section
      className="ops-screen"
      data-motion="page"
      data-reference="jnl9R"
    >
      <header className="ops-page-header">
        <div>
          <p className="ops-eyebrow">공급사·마켓 · 쿠팡</p>
          <h1>마켓 연동</h1>
          <p className="ops-description">
            판매자가 서비스 안에서 쿠팡을 직접 연결하고, 주문 수집과 운영 처리에 필요한
            자격증명을 워크스페이스별로 안전하게 보관합니다.
          </p>
        </div>
      </header>

      <CoupangIntegrationForm
        summary={data.summary}
        syncSummary={data.syncSummary}
      />
    </section>
  );
}

type CoupangIntegrationPageData = {
  summary: CoupangIntegrationSummary;
  syncSummary: CoupangSyncJobSummary;
};

async function loadCoupangIntegrationData(
  session: AuthenticatedSession,
): Promise<CoupangIntegrationPageData> {
  const env = getServerEnv();
  const context = buildTenantContext(session);

  if (env.E2E_TEST_MODE === "true") {
    const summary = getE2eCoupangIntegrationSummary(context);

    return {
      summary,
      syncSummary: summarizeCoupangSyncJobs(
        summary.status === "connected"
          ? [
              {
                type: "coupang.orders.collection.prepare",
                status: "queued",
                lastError: null,
                updatedAt: summary.credentialLastRotatedAt
                  ? new Date(summary.credentialLastRotatedAt)
                  : new Date(),
              },
              {
                type: "coupang.products.collection.prepare",
                status: "queued",
                lastError: null,
                updatedAt: summary.credentialLastRotatedAt
                  ? new Date(summary.credentialLastRotatedAt)
                  : new Date(),
              },
              {
                type: "coupang.cs.collection.prepare",
                status: "queued",
                lastError: null,
                updatedAt: summary.credentialLastRotatedAt
                  ? new Date(summary.credentialLastRotatedAt)
                  : new Date(),
              },
            ]
          : [],
      ),
    };
  }

  if (!env.DATABASE_URL) {
    return {
      summary: buildDefaultCoupangSummary({
        context,
        storageAvailable: false,
      }),
      syncSummary: summarizeCoupangSyncJobs([]),
    };
  }

  const db = createDb();
  const localSession = await ensureLocalIdentityForSession(db, session);
  const localContext = buildTenantContext(localSession);

  const summary = await getCoupangIntegrationSummary({
    db,
    context: localContext,
  });
  const syncSummary =
    summary.status === "connected"
      ? await getCoupangSyncJobSummary({
          db,
          context: localContext,
        })
      : summarizeCoupangSyncJobs([]);

  return {
    summary,
    syncSummary,
  };
}
