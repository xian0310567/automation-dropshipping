import type { ActorRole } from "@/server/rbac/policy";

export type AuthenticatedActor = {
  id: string;
  role: ActorRole;
};

type OperatorEnv = {
  OPERATOR_API_KEY?: string;
  OPERATOR_ACTOR_ID?: string;
  OPERATOR_ROLE?: string;
};

export type OperatorAuthResult =
  | {
      ok: true;
      actor: AuthenticatedActor;
    }
  | {
      ok: false;
      status: 401 | 503;
      message: string;
    };

export function authorizeOperatorRequest(request: Request): OperatorAuthResult {
  return authorizeOperatorHeaders({
    authorization: request.headers.get("authorization"),
    operatorKey:
      request.headers.get("x-operator-key") ??
      request.headers.get("x-operator-api-key"),
    env: process.env as OperatorEnv,
  });
}

export function authorizeOperatorHeaders(input: {
  authorization?: string | null;
  operatorKey?: string | null;
  env: OperatorEnv;
}): OperatorAuthResult {
  try {
    requireOperatorEnv(input.env);
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : "Operator auth is not configured",
    };
  }

  const expected = input.env.OPERATOR_API_KEY;
  const presented = extractBearerToken(input.authorization) ?? input.operatorKey;

  if (!presented || presented !== expected) {
    return {
      ok: false,
      status: 401,
      message: "Invalid operator authorization",
    };
  }

  return {
    ok: true,
    actor: {
      id: input.env.OPERATOR_ACTOR_ID,
      role: parseOperatorRole(input.env.OPERATOR_ROLE),
    },
  };
}

export function requireOperatorEnv(env: OperatorEnv): asserts env is {
  OPERATOR_API_KEY: string;
  OPERATOR_ACTOR_ID: string;
  OPERATOR_ROLE: ActorRole;
} {
  const missing = [
    ["OPERATOR_API_KEY", env.OPERATOR_API_KEY],
    ["OPERATOR_ACTOR_ID", env.OPERATOR_ACTOR_ID],
    ["OPERATOR_ROLE", env.OPERATOR_ROLE],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Operator auth requires: ${missing.join(", ")}`);
  }

  parseOperatorRole(env.OPERATOR_ROLE);
}

function extractBearerToken(authorization?: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

function parseOperatorRole(role: string | undefined): ActorRole {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "operator" ||
    role === "viewer"
  ) {
    return role;
  }

  throw new Error("OPERATOR_ROLE must be owner, admin, operator, or viewer");
}
