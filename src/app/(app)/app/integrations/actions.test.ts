import { describe, expect, it } from "vitest";
import { maskVendorId } from "@/server/integrations/coupang-credentials";
import { redactStructuredPayload } from "@/server/security/redaction";

describe("Coupang integration actions audit metadata", () => {
  it("records only a masked vendor id with redacted keys", () => {
    const metadata = redactStructuredPayload({
      provider: "coupang",
      maskedVendorId: maskVendorId("A00123456"),
      accessKey: "coupang-access-key",
      secretKey: "coupang-secret-key",
    });

    expect(metadata).toEqual({
      provider: "coupang",
      maskedVendorId: "A00****56",
      accessKey: "[REDACTED]",
      secretKey: "[REDACTED]",
    });
    expect(JSON.stringify(metadata)).not.toContain("A00123456");
    expect(JSON.stringify(metadata)).not.toContain("coupang-access-key");
    expect(JSON.stringify(metadata)).not.toContain("coupang-secret-key");
  });
});
