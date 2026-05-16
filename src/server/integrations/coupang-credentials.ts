import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { buildCoupangAuthorization } from "@/server/coupang/coupang-client";
import type { DbClient } from "@/server/db/client";
import { integrationAccounts } from "@/server/db/schema";
import {
  CREDENTIAL_KEY_VERSION,
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "@/server/security/envelope";
import type { ServerEnv } from "@/server/env-core";
import type { TenantContext } from "@/server/tenancy/context";
import { canPerformAction } from "@/server/rbac/policy";

export const COUPANG_PROVIDER = "coupang";

export type CoupangCredentialInput = {
  vendorId: string;
  accessKey: string;
  secretKey: string;
  displayName?: string;
};

export type CoupangIntegrationSummary = {
  provider: typeof COUPANG_PROVIDER;
  displayName: string;
  status: "not_configured" | "connected" | "needs_attention";
  maskedVendorId: string | null;
  credentialLastRotatedAt: string | null;
  lastSmokeTestAt: string | null;
  lastSmokeTestStatus: "not_tested" | "signature_ready" | "failed";
  canManage: boolean;
  storageAvailable: boolean;
};

export type StoredCoupangCredentials = CoupangCredentialInput & {
  accountId: string;
};

const coupangCredentialSchema = z.object({
  vendorId: z
    .string()
    .trim()
    .min(4, "쿠팡 판매자 ID를 입력해주세요.")
    .max(40, "쿠팡 판매자 ID는 40자 이하로 입력해주세요.")
    .regex(/^A[0-9A-Z_-]+$/i, "판매자 ID는 A로 시작하는 쿠팡 판매자 코드여야 합니다.")
    .transform((value) => value.toUpperCase()),
  accessKey: z
    .string()
    .trim()
    .min(8, "Access Key를 입력해주세요.")
    .max(200, "Access Key가 너무 깁니다."),
  secretKey: z
    .string()
    .trim()
    .min(8, "Secret Key를 입력해주세요.")
    .max(300, "Secret Key가 너무 깁니다."),
  displayName: z
    .string()
    .trim()
    .max(60, "표시 이름은 60자 이하로 입력해주세요.")
    .optional()
    .transform((value) => value || undefined),
});
const storedCoupangCredentialSchema = coupangCredentialSchema.omit({
  displayName: true,
});

export function parseCoupangCredentialInput(input: {
  vendorId: unknown;
  accessKey: unknown;
  secretKey: unknown;
  displayName?: unknown;
}) {
  return coupangCredentialSchema.safeParse(input);
}

export function buildDefaultCoupangSummary(input: {
  context: Pick<TenantContext, "role">;
  storageAvailable: boolean;
}): CoupangIntegrationSummary {
  return {
    provider: COUPANG_PROVIDER,
    displayName: "쿠팡",
    status: "not_configured",
    maskedVendorId: null,
    credentialLastRotatedAt: null,
    lastSmokeTestAt: null,
    lastSmokeTestStatus: "not_tested",
    canManage: canPerformAction({
      role: input.context.role,
      action: "manage_integration_credentials",
    }),
    storageAvailable: input.storageAvailable,
  };
}

export async function getCoupangIntegrationSummary(input: {
  db: DbClient;
  context: TenantContext;
}): Promise<CoupangIntegrationSummary> {
  const [account] = await input.db
    .select({
      displayName: integrationAccounts.displayName,
      status: integrationAccounts.status,
      credentialRef: integrationAccounts.credentialRef,
      credentialLastRotatedAt: integrationAccounts.credentialLastRotatedAt,
      lastSmokeTestAt: integrationAccounts.lastSmokeTestAt,
      lastSmokeTestStatus: integrationAccounts.lastSmokeTestStatus,
    })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.tenantId, input.context.tenantId),
        eq(integrationAccounts.provider, COUPANG_PROVIDER),
      ),
    )
    .limit(1);

  if (!account) {
    return buildDefaultCoupangSummary({
      context: input.context,
      storageAvailable: true,
    });
  }

  return {
    provider: COUPANG_PROVIDER,
    displayName: account.displayName,
    status: normalizeIntegrationStatus(account.status),
    maskedVendorId: unmaskableCredentialRef(account.credentialRef),
    credentialLastRotatedAt: account.credentialLastRotatedAt?.toISOString() ?? null,
    lastSmokeTestAt: account.lastSmokeTestAt?.toISOString() ?? null,
    lastSmokeTestStatus: normalizeSmokeStatus(account.lastSmokeTestStatus),
    canManage: canPerformAction({
      role: input.context.role,
      action: "manage_integration_credentials",
    }),
    storageAvailable: true,
  };
}

export async function getStoredCoupangCredentials(input: {
  db: DbClient;
  context: Pick<TenantContext, "tenantId">;
  env: Pick<ServerEnv, "PII_ENCRYPTION_KEY">;
}): Promise<StoredCoupangCredentials> {
  const [account] = await input.db
    .select({
      id: integrationAccounts.id,
      status: integrationAccounts.status,
      credentialEncryptedPayload: integrationAccounts.credentialEncryptedPayload,
    })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.tenantId, input.context.tenantId),
        eq(integrationAccounts.provider, COUPANG_PROVIDER),
      ),
    )
    .limit(1);

  if (!account || account.status !== "connected" || !account.credentialEncryptedPayload) {
    throw new Error("쿠팡 연동 정보가 연결되어 있지 않습니다.");
  }

  const decrypted = decryptCredentialPayload<unknown>(
    account.credentialEncryptedPayload,
    {
      tenantId: input.context.tenantId,
      provider: COUPANG_PROVIDER,
    },
    input.env,
  );
  const parsed = storedCoupangCredentialSchema.safeParse(decrypted);

  if (!parsed.success) {
    throw new Error("쿠팡 연동 정보 형식이 올바르지 않습니다.");
  }

  return {
    accountId: account.id,
    ...parsed.data,
  };
}

export async function saveCoupangIntegration(input: {
  db: DbClient;
  context: TenantContext;
  credentials: CoupangCredentialInput;
  env: Pick<ServerEnv, "PII_ENCRYPTION_KEY">;
}): Promise<CoupangIntegrationSummary> {
  assertCoupangCredentialsSignable(input.credentials);

  const now = new Date();
  const displayName =
    input.credentials.displayName ??
    `쿠팡 ${maskVendorId(input.credentials.vendorId)}`;
  const encryptedPayload = encryptCredentialPayload(
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

  await input.db
    .insert(integrationAccounts)
    .values({
      tenantId: input.context.tenantId,
      provider: COUPANG_PROVIDER,
      displayName,
      status: "connected",
      credentialRef: buildCredentialRef(input.credentials.vendorId),
      credentialEncryptedPayload: encryptedPayload,
      credentialKeyVersion: CREDENTIAL_KEY_VERSION,
      credentialLastRotatedAt: now,
      lastSmokeTestAt: now,
      lastSmokeTestStatus: "signature_ready",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [integrationAccounts.tenantId, integrationAccounts.provider],
      set: {
        displayName,
        status: "connected",
        credentialRef: buildCredentialRef(input.credentials.vendorId),
        credentialEncryptedPayload: encryptedPayload,
        credentialKeyVersion: CREDENTIAL_KEY_VERSION,
        credentialLastRotatedAt: now,
        lastSmokeTestAt: now,
        lastSmokeTestStatus: "signature_ready",
        updatedAt: now,
      },
    });

  return getCoupangIntegrationSummary({
    db: input.db,
    context: input.context,
  });
}

export async function disconnectCoupangIntegration(input: {
  db: DbClient;
  context: TenantContext;
}): Promise<void> {
  const now = new Date();

  await input.db
    .insert(integrationAccounts)
    .values({
      tenantId: input.context.tenantId,
      provider: COUPANG_PROVIDER,
      displayName: "쿠팡",
      status: "not_configured",
      credentialRef: null,
      credentialEncryptedPayload: null,
      credentialKeyVersion: null,
      credentialLastRotatedAt: null,
      lastSmokeTestAt: null,
      lastSmokeTestStatus: "not_tested",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [integrationAccounts.tenantId, integrationAccounts.provider],
      set: {
        displayName: "쿠팡",
        status: "not_configured",
        credentialRef: null,
        credentialEncryptedPayload: null,
        credentialKeyVersion: null,
        credentialLastRotatedAt: null,
        lastSmokeTestAt: null,
        lastSmokeTestStatus: "not_tested",
        updatedAt: now,
      },
    });
}

export function maskVendorId(vendorId: string): string {
  const normalized = vendorId.trim().toUpperCase();

  if (normalized.length <= 5) {
    return `${normalized.slice(0, 1)}***`;
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;
}

function buildCredentialRef(vendorId: string): string {
  const digest = createHash("sha256")
    .update(vendorId.trim().toUpperCase())
    .digest("hex")
    .slice(0, 16);

  return `${COUPANG_PROVIDER}:${maskVendorId(vendorId)}:${digest}`;
}

function unmaskableCredentialRef(ref: string | null): string | null {
  if (!ref) {
    return null;
  }

  const [, maskedVendorId] = ref.split(":");
  return maskedVendorId ?? null;
}

function normalizeIntegrationStatus(
  status: string,
): CoupangIntegrationSummary["status"] {
  if (status === "connected") {
    return "connected";
  }

  if (status === "needs_attention" || status === "error") {
    return "needs_attention";
  }

  return "not_configured";
}

function normalizeSmokeStatus(
  status: string | null,
): CoupangIntegrationSummary["lastSmokeTestStatus"] {
  if (status === "signature_ready" || status === "failed") {
    return status;
  }

  return "not_tested";
}

function assertCoupangCredentialsSignable(
  credentials: CoupangCredentialInput,
): void {
  buildCoupangAuthorization({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    method: "GET",
    pathWithQuery: `/v2/providers/openapi/apis/api/v4/vendors/${credentials.vendorId}/ordersheets`,
    signedDate: "260515T000000Z",
  });
}
