import { describe, expect, it } from "vitest";
import { redactSensitiveValue, redactStructuredPayload } from "./redaction";

describe("redaction", () => {
  it("masks API credentials, authorization headers, phone numbers, and addresses", () => {
    const redacted = redactStructuredPayload({
      accessKey: "AKIA-SECRET",
      secretKey: "very-secret",
      authorization: "CEA algorithm=HmacSHA256, access-key=sensitive",
      receiverName: "Hong Gil Dong",
      receiverPhone: "010-1234-5678",
      receiverAddress: "Seoul Gangnam-gu 123",
      trackingNumber: "TRACK-123456",
      safeStatus: "READY",
    });

    expect(redacted.accessKey).toBe("[REDACTED]");
    expect(redacted.secretKey).toBe("[REDACTED]");
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.receiverName).toBe("[REDACTED]");
    expect(redacted.receiverPhone).toBe("[REDACTED]");
    expect(redacted.receiverAddress).toBe("[REDACTED]");
    expect(redacted.trackingNumber).toBe("[REDACTED]");
    expect(redacted.safeStatus).toBe("READY");
  });

  it("redacts phone-like values inside strings", () => {
    expect(redactSensitiveValue("call 010-1234-5678 now")).toBe(
      "call [PHONE] now",
    );
  });
});
