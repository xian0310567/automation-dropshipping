import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";

const keyLength = 64;
const scryptParams = {
  n: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export type PasswordValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export function normalizeAuthEmail(value: string): string | null {
  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

export function validatePassword(value: string): PasswordValidationResult {
  if (Array.from(value).length < 10) {
    return {
      ok: false,
      message: "비밀번호는 10자 이상이어야 합니다.",
    };
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return {
      ok: false,
      message: "비밀번호에는 영문자와 숫자를 모두 포함해주세요.",
    };
  }

  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveScryptKey(password, salt, keyLength, {
    N: scryptParams.n,
    r: scryptParams.r,
    p: scryptParams.p,
    maxmem: scryptParams.maxmem,
  });

  return [
    "scrypt",
    String(scryptParams.n),
    String(scryptParams.r),
    String(scryptParams.p),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parts = encodedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, n, r, p, saltValue, hashValue] = parts;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await deriveScryptKey(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: scryptParams.maxmem,
  });

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function deriveScryptKey(
  password: string,
  salt: Buffer,
  length: number,
  options: {
    N: number;
    r: number;
    p: number;
    maxmem: number;
  },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
