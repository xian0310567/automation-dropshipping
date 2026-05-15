import "server-only";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedSession } from "@/server/auth/session-core";
import type { DbClient } from "@/server/db/client";
import { memberships, tenants, users } from "@/server/db/schema";

export class LocalIdentityError extends Error {
  readonly status = 403;

  constructor(message = "Active local membership is required") {
    super(message);
    this.name = "LocalIdentityError";
  }
}

export async function ensureLocalIdentityForSession(
  db: DbClient,
  session: AuthenticatedSession,
): Promise<AuthenticatedSession> {
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: session.userId,
      authProvider: session.authProvider,
      authSubjectId: session.authSubjectId,
      email: session.email,
      name: session.name,
      status: "active",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [users.authProvider, users.authSubjectId],
      set: {
        email: session.email,
        name: session.name,
        updatedAt: now,
      },
    });

  await db
    .insert(tenants)
    .values({
      id: session.tenantId,
      name: session.tenantName,
      slug: session.tenantSlug,
      status: "active",
      ownerUserId:
        session.membershipRole === "owner" ? session.userId : undefined,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        name: session.tenantName,
        slug: session.tenantSlug,
        updatedAt: now,
      },
    });

  await db
    .insert(memberships)
    .values({
      tenantId: session.tenantId,
      userId: session.userId,
      role: session.membershipRole,
      status: "active",
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [memberships.tenantId, memberships.userId],
    });

  const [membership] = await db
    .select({
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.tenantId, session.tenantId),
        eq(memberships.userId, session.userId),
      ),
    )
    .limit(1);

  if (!membership || membership.status !== "active") {
    throw new LocalIdentityError();
  }

  return {
    ...session,
    membershipRole: membership.role,
  };
}
