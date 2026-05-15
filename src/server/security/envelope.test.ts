import { describe, expect, it } from "vitest";
import {
  CredentialEnvelopeError,
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "./envelope";

const env = {
  PII_ENCRYPTION_KEY: "unit-test-secret",
};

describe("credential envelope", () => {
  it("encrypts tenant credentials without storing plaintext", () => {
    const encrypted = encryptCredentialPayload(
      {
        vendorId: "A00123456",
        accessKey: "access-key",
        secretKey: "secret-key",
      },
      {
        tenantId: "tenant-a",
        provider: "coupang",
      },
      env,
    );

    expect(encrypted).not.toContain("A00123456");
    expect(encrypted).not.toContain("access-key");
    expect(encrypted).not.toContain("secret-key");

    expect(
      decryptCredentialPayload(encrypted, {
        tenantId: "tenant-a",
        provider: "coupang",
      }, env),
    ).toEqual({
      vendorId: "A00123456",
      accessKey: "access-key",
      secretKey: "secret-key",
    });
  });

  it("binds encrypted payloads to the tenant and provider context", () => {
    const encrypted = encryptCredentialPayload(
      {
        vendorId: "A00123456",
      },
      {
        tenantId: "tenant-a",
        provider: "coupang",
      },
      env,
    );

    expect(() =>
      decryptCredentialPayload(encrypted, {
        tenantId: "tenant-b",
        provider: "coupang",
      }, env),
    ).toThrow();
  });

  it("requires an encryption key before writing credentials", () => {
    expect(() =>
      encryptCredentialPayload(
        {
          vendorId: "A00123456",
        },
        {
          tenantId: "tenant-a",
          provider: "coupang",
        },
        {
          PII_ENCRYPTION_KEY: undefined,
        },
      ),
    ).toThrow(CredentialEnvelopeError);
  });
});
