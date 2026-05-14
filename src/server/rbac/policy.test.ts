import { describe, expect, it } from "vitest";
import { canPerformAction } from "./policy";

describe("canPerformAction", () => {
  it("lets admins and owners execute protected marketplace actions", () => {
    expect(canPerformAction({ role: "owner", action: "execute_mutation" })).toBe(
      true,
    );
    expect(canPerformAction({ role: "admin", action: "execute_mutation" })).toBe(
      true,
    );
  });

  it("keeps operators and viewers away from protected mutations", () => {
    expect(
      canPerformAction({ role: "operator", action: "execute_mutation" }),
    ).toBe(false);
    expect(canPerformAction({ role: "viewer", action: "execute_mutation" })).toBe(
      false,
    );
  });
});
