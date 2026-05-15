import { describe, expect, it } from "vitest";
import type { AuthenticatedSession } from "@/server/auth/session-core";
import {
  TenantAccessError,
  assertTenantScopedRecord,
  buildTenantContext,
  requireTenantAction,
  resolveTenantContext,
  tenantAuditActor,
} from "./context";

const ownerSession: AuthenticatedSession = {
  authProvider: "development",
  authSubjectId: "dev:owner@example.com",
  userId: "user-1",
  email: "owner@example.com",
  name: "Owner",
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  tenantSlug: "tenant-a",
  membershipRole: "owner",
  issuedAt: "2026-05-15T00:00:00.000Z",
};

describe("tenant context", () => {
  it("builds audit actor attribution from server-owned session membership", () => {
    const context = buildTenantContext(ownerSession);

    expect(tenantAuditActor(context)).toEqual({
      tenantId: "tenant-a",
      userId: "user-1",
      membershipRole: "owner",
      authProvider: "development",
      authSubjectId: "dev:owner@example.com",
    });
  });

  it("rejects client-selected tenants outside the active membership", () => {
    expect(() =>
      resolveTenantContext({
        session: ownerSession,
        requestedTenantId: "tenant-b",
      }),
    ).toThrow(TenantAccessError);
  });

  it("requires role permission before protected tenant actions", () => {
    const viewerContext = buildTenantContext({
      ...ownerSession,
      membershipRole: "viewer",
    });

    expect(() =>
      requireTenantAction({
        context: viewerContext,
        action: "approve_mutation",
      }),
    ).toThrow(TenantAccessError);
  });

  it("blocks records that do not belong to the active tenant", () => {
    const context = buildTenantContext(ownerSession);

    expect(
      assertTenantScopedRecord(context, {
        tenantId: "tenant-a",
        id: "row-1",
      }),
    ).toMatchObject({ id: "row-1" });
    expect(() =>
      assertTenantScopedRecord(context, {
        tenantId: "tenant-b",
        id: "row-2",
      }),
    ).toThrow(TenantAccessError);
  });
});
