import { createHmac } from "node:crypto";

export const COUPANG_MAX_REQUESTS_PER_SECOND = 4;

export function buildCoupangAuthorization(input: {
  accessKey: string;
  secretKey: string;
  method: string;
  pathWithQuery: string;
  signedDate: string;
}): string {
  const message = `${input.signedDate}${input.method.toUpperCase()}${input.pathWithQuery}`;
  const signature = createHmac("sha256", input.secretKey)
    .update(message)
    .digest("hex");

  return [
    "CEA algorithm=HmacSHA256",
    `access-key=${input.accessKey}`,
    `signed-date=${input.signedDate}`,
    `signature=${signature}`,
  ].join(", ");
}

export function shouldPauseCoupangJobs(input: {
  totalRequests: number;
  rateLimited: number;
}): boolean {
  if (input.totalRequests === 0) {
    return false;
  }

  return input.rateLimited / input.totalRequests > 0.2;
}
