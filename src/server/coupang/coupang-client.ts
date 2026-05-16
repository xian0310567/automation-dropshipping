import { createHmac, randomUUID } from "node:crypto";

export const COUPANG_API_BASE_URL = "https://api-gateway.coupang.com";
export const COUPANG_MAX_REQUESTS_PER_SECOND = 4;

export type CoupangCredentials = {
  vendorId: string;
  accessKey: string;
  secretKey: string;
};

export type CoupangMarket = "KR" | "TW";

export type CoupangFetch = (
  input: string,
  init: {
    headers: Record<string, string>;
    method: string;
  },
) => Promise<{
  headers?: {
    get: (name: string) => string | null;
  };
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type CoupangRequestLog = {
  durationMs: number;
  method: string;
  pathWithQuery: string;
  requestHash: string;
  responseSummary: Record<string, unknown> | null;
  statusCode: number;
};

export class CoupangApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly log?: CoupangRequestLog,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "CoupangApiError";
  }
}

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

export function buildCoupangHeaders(input: {
  credentials: CoupangCredentials;
  market?: string;
  method: string;
  pathWithQuery: string;
  signedDate: string;
}): Record<string, string> {
  return {
    Authorization: buildCoupangAuthorization({
      accessKey: input.credentials.accessKey,
      secretKey: input.credentials.secretKey,
      method: input.method,
      pathWithQuery: input.pathWithQuery,
      signedDate: input.signedDate,
    }),
    "Content-Type": "application/json;charset=UTF-8",
    "X-MARKET": input.market || "KR",
    "X-Requested-By": input.credentials.vendorId,
  };
}

export function buildCoupangPathWithQuery(input: {
  path: string;
  query?: Record<string, string | number | null | undefined>;
}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();

  return query ? `${input.path}?${query}` : input.path;
}

export function formatCoupangSignedDate(date = new Date()): string {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

export async function requestCoupangJson<TResponse>(input: {
  baseUrl?: string;
  credentials: CoupangCredentials;
  fetchImpl?: CoupangFetch;
  market?: string;
  method?: "GET";
  now?: () => Date;
  path: string;
  query?: Record<string, string | number | null | undefined>;
}): Promise<{
  body: TResponse;
  log: CoupangRequestLog;
}> {
  const method = input.method ?? "GET";
  const pathWithQuery = buildCoupangPathWithQuery({
    path: input.path,
    query: input.query,
  });
  const requestDate = input.now?.() ?? new Date();
  const signedDate = formatCoupangSignedDate(requestDate);
  const startedAt = Date.now();
  const response = await (input.fetchImpl ?? fetch)(`${input.baseUrl ?? COUPANG_API_BASE_URL}${pathWithQuery}`, {
    method,
    headers: buildCoupangHeaders({
      credentials: input.credentials,
      market: input.market,
      method,
      pathWithQuery,
      signedDate,
    }),
  });
  const text = await response.text();
  const durationMs = Date.now() - startedAt;
  const requestHash = createCoupangRequestHash({
    method,
    pathWithQuery,
    signedDate,
    statusCode: response.status,
  });

  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const log = {
    durationMs,
    method,
    pathWithQuery,
    requestHash,
    responseSummary: summarizeCoupangResponse(parsed),
    statusCode: response.status,
  };

  if (!response.ok) {
    throw new CoupangApiError(
      `Coupang API request failed with HTTP ${response.status}`,
      response.status,
      log,
      parseRetryAfterMs(response.headers?.get("retry-after"), requestDate),
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CoupangApiError(
      "Coupang API response was not valid JSON",
      response.status,
      log,
    );
  }

  return {
    body: parsed as TResponse,
    log,
  };
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

function parseRetryAfterMs(
  retryAfter: string | null | undefined,
  now: Date,
): number | undefined {
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = new Date(retryAfter).getTime();

  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - now.getTime());
}

function createCoupangRequestHash(input: {
  method: string;
  pathWithQuery: string;
  signedDate: string;
  statusCode: number;
}): string {
  return createHmac("sha256", input.signedDate)
    .update(`${input.method}:${input.pathWithQuery}:${input.statusCode}:${randomUUID()}`)
    .digest("hex");
}

function summarizeCoupangResponse(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const response = value as {
    code?: unknown;
    data?: unknown;
    message?: unknown;
    nextToken?: unknown;
  };

  return {
    code: response.code,
    dataCount: Array.isArray(response.data) ? response.data.length : undefined,
    hasData: Boolean(response.data),
    message: typeof response.message === "string" ? response.message.slice(0, 120) : undefined,
    nextTokenPresent: typeof response.nextToken === "string" && response.nextToken.length > 0,
  };
}
