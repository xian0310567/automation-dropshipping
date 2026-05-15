import { authorizeOperatorRequest } from "@/server/auth/operator";
import { getCurrentAuthSession } from "@/server/auth/session";
import { isDevelopmentSessionEnabled } from "@/server/auth/session-core";
import {
  LocalIdentityError,
  ensureLocalIdentityForSession,
} from "@/server/auth/local-identity";
import type { DbClient } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import type { ActorRole, ProtectedAction } from "@/server/rbac/policy";
import {
  buildTenantContext,
  requireTenantAction,
  type TenantContext,
} from "@/server/tenancy/context";

export type ProtectedRequestContext = {
  source: "session" | "operator";
  actor: {
    id: string;
    role: ActorRole;
  };
  tenant: TenantContext | null;
};

export type ProtectedRequestResult =
  | {
      ok: true;
      context: ProtectedRequestContext;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      message: string;
    };

export async function authorizeProtectedRequest(
  request: Request,
  action: ProtectedAction,
  options: {
    db?: DbClient;
    requireLocalIdentity?: boolean;
  } = {},
): Promise<ProtectedRequestResult> {
  let session = await getCurrentAuthSession();

  if (session) {
    try {
      if (options.requireLocalIdentity) {
        if (!options.db) {
          throw new Error("Database client is required for local identity checks");
        }

        session = await ensureLocalIdentityForSession(options.db, session);
      }

      const tenant = requireTenantAction({
        context: buildTenantContext(session),
        action,
      });

      return {
        ok: true,
        context: {
          source: "session",
          actor: {
            id: session.userId,
            role: session.membershipRole,
          },
          tenant,
        },
      };
    } catch (error) {
      if (error instanceof LocalIdentityError) {
        return {
          ok: false,
          status: error.status,
          message: error.message,
        };
      }

      return {
        ok: false,
        status: options.requireLocalIdentity ? 503 : 403,
        message: error instanceof Error ? error.message : "Forbidden",
      };
    }
  }

  if (!isOperatorFallbackAllowed()) {
    return {
      ok: false,
      status: 401,
      message: "Authentication is required",
    };
  }

  const operator = authorizeOperatorRequest(request);

  if (!operator.ok) {
    return operator;
  }

  return {
    ok: true,
    context: {
      source: "operator",
      actor: operator.actor,
      tenant: null,
    },
  };
}

function isOperatorFallbackAllowed(): boolean {
  const env = getServerEnv();
  return isDevelopmentSessionEnabled(env);
}
