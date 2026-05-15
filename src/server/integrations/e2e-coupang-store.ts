import "server-only";
import { buildCoupangAuthorization } from "@/server/coupang/coupang-client";
import type { ServerEnv } from "@/server/env-core";
import {
  encryptCredentialPayload,
} from "@/server/security/envelope";
import type { TenantContext } from "@/server/tenancy/context";
import {
  buildDefaultCoupangSummary,
  COUPANG_PROVIDER,
  maskVendorId,
  type CoupangCredentialInput,
  type CoupangIntegrationSummary,
} from "./coupang-credentials";

type StoredCoupangSummary = Omit<
  CoupangIntegrationSummary,
  "canManage" | "storageAvailable"
>;

const globalStore = globalThis as typeof globalThis & {
  __coupangIntegrationE2eStore?: Map<string, StoredCoupangSummary>;
};

function getStore() {
  globalStore.__coupangIntegrationE2eStore ??= new Map();
  return globalStore.__coupangIntegrationE2eStore;
}

export function getE2eCoupangIntegrationSummary(
  context: TenantContext,
): CoupangIntegrationSummary {
  const stored = getStore().get(context.tenantId);

  if (!stored) {
    return buildDefaultCoupangSummary({
      context,
      storageAvailable: true,
    });
  }

  return {
    ...stored,
    canManage: context.role === "owner" || context.role === "admin",
    storageAvailable: true,
  };
}

export function saveE2eCoupangIntegration(input: {
  context: TenantContext;
  credentials: CoupangCredentialInput;
  env: Pick<ServerEnv, "PII_ENCRYPTION_KEY">;
}): CoupangIntegrationSummary {
  const now = new Date().toISOString();

  buildCoupangAuthorization({
    accessKey: input.credentials.accessKey,
    secretKey: input.credentials.secretKey,
    method: "GET",
    pathWithQuery: `/v2/providers/openapi/apis/api/v4/vendors/${input.credentials.vendorId}/ordersheets`,
    signedDate: "260515T000000Z",
  });
  encryptCredentialPayload(
    {
      vendorId: input.credentials.vendorId,
      accessKey: input.credentials.accessKey,
      secretKey: input.credentials.secretKey,
    },
    {
      tenantId: input.context.tenantId,
      provider: COUPANG_PROVIDER,
    },
    input.env,
  );

  getStore().set(input.context.tenantId, {
    provider: COUPANG_PROVIDER,
    displayName:
      input.credentials.displayName ??
      `쿠팡 ${maskVendorId(input.credentials.vendorId)}`,
    status: "connected",
    maskedVendorId: maskVendorId(input.credentials.vendorId),
    credentialLastRotatedAt: now,
    lastSmokeTestAt: now,
    lastSmokeTestStatus: "signature_ready",
  });

  return getE2eCoupangIntegrationSummary(input.context);
}

export function disconnectE2eCoupangIntegration(context: TenantContext): void {
  getStore().delete(context.tenantId);
}
