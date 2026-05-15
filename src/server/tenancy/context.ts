import type { AuthenticatedSession } from "@/server/auth/session-core";
import { canPerformAction, type ProtectedAction } from "@/server/rbac/policy";

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  authProvider: AuthenticatedSession["authProvider"];
  authSubjectId: string;
  role: AuthenticatedSession["membershipRole"];
};

export type TenantScopedRecord = {
  tenantId: string | null;
};

export class TenantAccessError extends Error {
  readonly status = 403;

  constructor(message = "Tenant access is not allowed") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export function buildTenantContext(
  session: AuthenticatedSession,
): TenantContext {
  return {
    tenantId: session.tenantId,
    tenantName: session.tenantName,
    tenantSlug: session.tenantSlug,
    userId: session.userId,
    userEmail: session.email,
    authProvider: session.authProvider,
    authSubjectId: session.authSubjectId,
    role: session.membershipRole,
  };
}

export function resolveTenantContext(input: {
  session: AuthenticatedSession;
  requestedTenantId?: string | null;
}): TenantContext {
  const context = buildTenantContext(input.session);

  if (
    input.requestedTenantId &&
    input.requestedTenantId !== context.tenantId
  ) {
    throw new TenantAccessError("Requested tenant is outside this membership");
  }

  return context;
}

export function requireTenantAction(input: {
  context: TenantContext;
  action: ProtectedAction;
}): TenantContext {
  if (
    !canPerformAction({
      role: input.context.role,
      action: input.action,
    })
  ) {
    throw new TenantAccessError("Membership role cannot perform this action");
  }

  return input.context;
}

export function assertTenantScopedRecord<TRecord extends TenantScopedRecord>(
  context: TenantContext,
  record: TRecord,
): TRecord {
  if (!record.tenantId || record.tenantId !== context.tenantId) {
    throw new TenantAccessError("Record belongs to another tenant");
  }

  return record;
}

export function tenantAuditActor(context: TenantContext) {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    membershipRole: context.role,
    authProvider: context.authProvider,
    authSubjectId: context.authSubjectId,
  };
}
