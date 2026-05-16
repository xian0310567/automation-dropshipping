import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeAuthEmail,
  validatePassword,
  verifyPassword,
} from "./password-core";

describe("password auth core", () => {
  it("normalizes usable login emails and rejects malformed ones", () => {
    expect(normalizeAuthEmail(" OWNER@Example.COM ")).toBe("owner@example.com");
    expect(normalizeAuthEmail("not-an-email")).toBeNull();
    expect(normalizeAuthEmail("")).toBeNull();
  });

  it("enforces a production-ready password baseline", () => {
    expect(validatePassword("short")).toEqual({
      ok: false,
      message: "비밀번호는 10자 이상이어야 합니다.",
    });
    expect(validatePassword("averylongpassword")).toEqual({
      ok: false,
      message: "비밀번호에는 영문자와 숫자를 모두 포함해주세요.",
    });
    expect(validatePassword("safe-password-2026")).toEqual({ ok: true });
  });

  it("hashes passwords without storing plaintext and verifies attempts", async () => {
    const encoded = await hashPassword("safe-password-2026");

    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain("safe-password-2026");
    await expect(verifyPassword("safe-password-2026", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password-2026", encoded)).resolves.toBe(false);
  });

  it("generates bearer session tokens and stores only a stable hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashSessionToken(token));
    expect(hash).not.toBe(token);
  });
});
