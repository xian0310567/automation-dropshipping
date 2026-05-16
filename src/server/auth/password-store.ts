import "server-only";
import { randomBytes, randomUUID } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { ActorRole } from "@/server/rbac/policy";
import type { AuthenticatedSession } from "@/server/auth/session-core";
import type { DbClient } from "@/server/db/client";
import {
  authSessions,
  memberships,
  passwordCredentials,
  tenants,
  users,
} from "@/server/db/schema";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeAuthEmail,
  validatePassword,
  verifyPassword,
} from "./password-core";

export const PASSWORD_SESSION_COOKIE = "oc_session";

const sessionTtlMs = 1000 * 60 * 60 * 24 * 14;

export type PasswordAuthSuccess = {
  ok: true;
  session: AuthenticatedSession;
  token: string;
  expiresAt: Date;
};

export type PasswordAuthFailure = {
  ok: false;
  code:
    | "invalid_credentials"
    | "invalid_email"
    | "weak_password"
    | "email_taken"
    | "invalid_workspace";
  message: string;
};

export type PasswordAuthResult = PasswordAuthSuccess | PasswordAuthFailure;

export async function createPasswordAccount(
  db: DbClient,
  input: {
    email: string;
    password: string;
    name: string;
    tenantName: string;
  },
): Promise<PasswordAuthResult> {
  const email = normalizeAuthEmail(input.email);

  if (!email) {
    return {
      ok: false,
      code: "invalid_email",
      message: "사용 가능한 이메일을 입력해주세요.",
    };
  }

  const passwordValidation = validatePassword(input.password);

  if (!passwordValidation.ok) {
    return {
      ok: false,
      code: "weak_password",
      message: passwordValidation.message,
    };
  }

  const name = input.name.trim() || "운영자";
  const tenantName = input.tenantName.trim();

  if (!tenantName) {
    return {
      ok: false,
      code: "invalid_workspace",
      message: "워크스페이스 이름을 입력해주세요.",
    };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return {
      ok: false,
      code: "email_taken",
      message: "이미 가입된 이메일입니다. 로그인해주세요.",
    };
  }

  const now = new Date();
  const userId = randomUUID();
  const tenantId = randomUUID();
  const tenantSlug = createTenantSlug(tenantName);
  const passwordHash = await hashPassword(input.password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        authProvider: "password",
        authSubjectId: userId,
        email,
        name,
        status: "active",
        updatedAt: now,
      }),
      db.insert(passwordCredentials).values({
        userId,
        passwordHash,
        updatedAt: now,
      }),
      db.insert(tenants).values({
        id: tenantId,
        name: tenantName,
        slug: tenantSlug,
        status: "active",
        ownerUserId: userId,
        updatedAt: now,
      }),
      db.insert(memberships).values({
        tenantId,
        userId,
        role: "owner",
        status: "active",
        updatedAt: now,
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        code: "email_taken",
        message: "이미 가입된 이메일입니다. 로그인해주세요.",
      };
    }

    throw error;
  }

  return createPasswordSession(db, {
    userId,
    email,
    name,
    tenantId,
    tenantName,
    tenantSlug,
    membershipRole: "owner",
  });
}

export async function authenticatePassword(
  db: DbClient,
  input: {
    email: string;
    password: string;
  },
): Promise<PasswordAuthResult> {
  const email = normalizeAuthEmail(input.email);

  if (!email) {
    return invalidCredentials();
  }

  const [account] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      passwordHash: passwordCredentials.passwordHash,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      membershipRole: memberships.role,
    })
    .from(users)
    .innerJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(
      and(
        eq(users.email, email),
        eq(users.status, "active"),
        eq(memberships.status, "active"),
        eq(tenants.status, "active"),
      ),
    )
    .limit(1);

  if (!account) {
    return invalidCredentials();
  }

  const passwordMatches = await verifyPassword(input.password, account.passwordHash);

  if (!passwordMatches) {
    return invalidCredentials();
  }

  return createPasswordSession(db, account);
}

export async function getPasswordSessionFromToken(
  db: DbClient,
  token: string | undefined,
): Promise<AuthenticatedSession | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [record] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      membershipRole: memberships.role,
      issuedAt: authSessions.createdAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, users.id),
        eq(memberships.tenantId, authSessions.tenantId),
      ),
    )
    .innerJoin(tenants, eq(tenants.id, authSessions.tenantId))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
        eq(users.status, "active"),
        eq(memberships.status, "active"),
        eq(tenants.status, "active"),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  return buildPasswordSession(record);
}

export async function revokePasswordSession(
  db: DbClient,
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }

  await db
    .update(authSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(authSessions.tokenHash, hashSessionToken(token)));
}

async function createPasswordSession(
  db: DbClient,
  account: {
    userId: string;
    email: string;
    name: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    membershipRole: ActorRole;
  },
): Promise<PasswordAuthSuccess> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs);
  const now = new Date();

  await db.insert(authSessions).values({
    userId: account.userId,
    tenantId: account.tenantId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    updatedAt: now,
  });

  return {
    ok: true,
    token,
    expiresAt,
    session: buildPasswordSession({
      ...account,
      issuedAt: now,
    }),
  };
}

function buildPasswordSession(account: {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  membershipRole: ActorRole;
  issuedAt: Date;
}): AuthenticatedSession {
  return {
    authProvider: "password",
    authSubjectId: account.userId,
    userId: account.userId,
    email: account.email,
    name: account.name,
    tenantId: account.tenantId,
    tenantName: account.tenantName,
    tenantSlug: account.tenantSlug,
    membershipRole: account.membershipRole,
    issuedAt: account.issuedAt.toISOString(),
  };
}

function invalidCredentials(): PasswordAuthFailure {
  return {
    ok: false,
    code: "invalid_credentials",
    message: "이메일 또는 비밀번호가 올바르지 않습니다.",
  };
}

function createTenantSlug(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const suffix = randomBytes(3).toString("hex");

  return `${base || "workspace"}-${suffix}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /duplicate key value violates unique constraint/i.test(error.message)
  );
}
