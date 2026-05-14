import { describe, expect, it } from "vitest";
import {
  authorizeOperatorHeaders,
  requireOperatorEnv,
} from "./operator";

describe("authorizeOperatorHeaders", () => {
  it("resolves actor identity from server env instead of request body", () => {
    expect(
      authorizeOperatorHeaders({
        authorization: "Bearer operator-secret",
        env: {
          OPERATOR_API_KEY: "operator-secret",
          OPERATOR_ACTOR_ID: "actor-1",
          OPERATOR_ROLE: "admin",
        },
      }),
    ).toEqual({
      ok: true,
      actor: {
        id: "actor-1",
        role: "admin",
      },
    });
  });

  it("rejects missing or invalid operator credentials", () => {
    expect(
      authorizeOperatorHeaders({
        authorization: "Bearer wrong",
        env: {
          OPERATOR_API_KEY: "operator-secret",
          OPERATOR_ACTOR_ID: "actor-1",
          OPERATOR_ROLE: "owner",
        },
      }),
    ).toMatchObject({ ok: false, status: 401 });
  });
});

describe("requireOperatorEnv", () => {
  it("fails closed when the protected-route auth env is incomplete", () => {
    expect(() => requireOperatorEnv({ OPERATOR_API_KEY: "secret" })).toThrow(
      /OPERATOR_ACTOR_ID/,
    );
  });
});
