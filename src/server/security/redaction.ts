const sensitiveKeyPattern =
  /(accessKey|secretKey|authorization|token|password|receiverName|buyerName|receiverPhone|phone|receiverAddress|address|trackingNumber)/i;
const phonePattern = /\b(?:\+?82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g;

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(phonePattern, "[PHONE]");
}

export function redactStructuredPayload<T extends Record<string, unknown>>(
  payload: T,
): Record<keyof T, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactSensitiveValue(value),
    ]),
  ) as Record<keyof T, unknown>;
}
