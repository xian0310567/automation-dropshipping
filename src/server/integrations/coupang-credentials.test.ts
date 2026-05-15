import { describe, expect, it } from "vitest";
import {
  buildDefaultCoupangSummary,
  maskVendorId,
  parseCoupangCredentialInput,
} from "./coupang-credentials";

describe("coupang credentials", () => {
  it("normalizes valid Coupang Open API credentials", () => {
    const parsed = parseCoupangCredentialInput({
      vendorId: "a00123456",
      accessKey: " coupang-access-key ",
      secretKey: " coupang-secret-key ",
      displayName: "  본점 쿠팡  ",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data).toEqual({
      vendorId: "A00123456",
      accessKey: "coupang-access-key",
      secretKey: "coupang-secret-key",
      displayName: "본점 쿠팡",
    });
  });

  it("rejects malformed vendor ids before writing secrets", () => {
    const parsed = parseCoupangCredentialInput({
      vendorId: "vendor-123",
      accessKey: "coupang-access-key",
      secretKey: "coupang-secret-key",
    });

    expect(parsed.success).toBe(false);
  });

  it("builds a safe not-configured DTO without credential data", () => {
    expect(
      buildDefaultCoupangSummary({
        context: {
          role: "owner",
        },
        storageAvailable: false,
      }),
    ).toEqual({
      provider: "coupang",
      displayName: "쿠팡",
      status: "not_configured",
      maskedVendorId: null,
      credentialLastRotatedAt: null,
      lastSmokeTestAt: null,
      lastSmokeTestStatus: "not_tested",
      canManage: true,
      storageAvailable: false,
    });
  });

  it("masks vendor ids for UI display", () => {
    expect(maskVendorId("A00123456")).toBe("A00****56");
  });
});
