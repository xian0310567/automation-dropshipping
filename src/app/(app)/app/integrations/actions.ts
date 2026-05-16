"use server";

import { revalidatePath } from "next/cache";
import { ensureLocalIdentityForSession } from "@/server/auth/local-identity";
import { requireAuthSession } from "@/server/auth/session";
import {
  cancelCoupangSyncJobs,
  scheduleCoupangInitialSyncJobs,
} from "@/server/coupang/sync-jobs";
import { createDb } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";
import { getServerEnv } from "@/server/env";
import {
  disconnectE2eCoupangIntegration,
  saveE2eCoupangIntegration,
} from "@/server/integrations/e2e-coupang-store";
import {
  COUPANG_PROVIDER,
  disconnectCoupangIntegration,
  maskVendorId,
  parseCoupangCredentialInput,
  saveCoupangIntegration,
} from "@/server/integrations/coupang-credentials";
import { redactStructuredPayload } from "@/server/security/redaction";
import {
  buildTenantContext,
  requireTenantAction,
  tenantAuditActor,
} from "@/server/tenancy/context";

export type CoupangIntegrationFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Partial<
    Record<"vendorId" | "accessKey" | "secretKey" | "displayName", string>
  >;
};

export async function saveCoupangIntegrationAction(
  _previousState: CoupangIntegrationFormState,
  formData: FormData,
): Promise<CoupangIntegrationFormState> {
  const parsed = parseCoupangCredentialInput({
    vendorId: formData.get("vendorId"),
    accessKey: formData.get("accessKey"),
    secretKey: formData.get("secretKey"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인해주세요.",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(
          ([field, messages]) => [field, messages?.[0]],
        ),
      ),
    };
  }

  try {
    const env = getServerEnv();
    const session = await requireAuthSession("/app/integrations");
    const context = requireTenantAction({
      context: buildTenantContext(session),
      action: "manage_integration_credentials",
    });

    if (env.E2E_TEST_MODE === "true") {
      saveE2eCoupangIntegration({
        context,
        credentials: parsed.data,
        env,
      });
      revalidatePath("/app/integrations");

      return {
        status: "success",
        message: "쿠팡 연동 정보를 안전하게 저장했습니다.",
        fieldErrors: {},
      };
    }

    const db = createDb();
    const localSession = await ensureLocalIdentityForSession(db, session);
    const localContext = requireTenantAction({
      context: buildTenantContext(localSession),
      action: "manage_integration_credentials",
    });

    await saveCoupangIntegration({
      db,
      context: localContext,
      credentials: parsed.data,
      env,
    });
    await scheduleCoupangInitialSyncJobs({
      db,
      context: localContext,
    });

    await db.insert(auditLogs).values({
      eventType: "integration.coupang.connected",
      ...tenantAuditActor(localContext),
      reason: "쿠팡 연동 정보 저장",
      metadata: redactStructuredPayload({
        provider: COUPANG_PROVIDER,
        maskedVendorId: maskVendorId(parsed.data.vendorId),
        displayName: parsed.data.displayName ?? null,
        accessKey: parsed.data.accessKey,
        secretKey: parsed.data.secretKey,
      }),
    });

    revalidatePath("/app/integrations");
    revalidatePath("/app/onboarding");

    return {
      status: "success",
      message: "쿠팡 연동 정보를 안전하게 저장했습니다.",
      fieldErrors: {},
    };
  } catch (error) {
    return {
      status: "error",
      message: mapIntegrationError(error),
      fieldErrors: {},
    };
  }
}

export async function disconnectCoupangIntegrationAction(): Promise<void> {
  const session = await requireAuthSession("/app/integrations");
  const env = getServerEnv();
  const context = requireTenantAction({
    context: buildTenantContext(session),
    action: "manage_integration_credentials",
  });

  if (env.E2E_TEST_MODE === "true") {
    disconnectE2eCoupangIntegration(context);
    revalidatePath("/app/integrations");
    revalidatePath("/app/onboarding");
    return;
  }

  const db = createDb();
  const localSession = await ensureLocalIdentityForSession(db, session);
  const localContext = requireTenantAction({
    context: buildTenantContext(localSession),
    action: "manage_integration_credentials",
  });

  await disconnectCoupangIntegration({
    db,
    context: localContext,
  });
  await cancelCoupangSyncJobs({
    db,
    context: localContext,
  });

  await db.insert(auditLogs).values({
    eventType: "integration.coupang.disconnected",
    ...tenantAuditActor(localContext),
    reason: "쿠팡 연동 해제",
    metadata: {
      provider: COUPANG_PROVIDER,
    },
  });

  revalidatePath("/app/integrations");
  revalidatePath("/app/onboarding");
}

function mapIntegrationError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("PII_ENCRYPTION_KEY")) {
      return "자격증명을 암호화할 키가 아직 설정되지 않았습니다.";
    }

    if (error.message.includes("Membership role")) {
      return "연동 정보를 변경할 권한이 없습니다.";
    }

    if (error.message.includes("DATABASE_URL")) {
      return "연동 정보를 저장할 저장소 연결이 아직 준비되지 않았습니다.";
    }
  }

  return "쿠팡 연동 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
