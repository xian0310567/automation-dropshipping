import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { ServerEnv } from "@/server/env-core";

export const CREDENTIAL_ENVELOPE_VERSION = "credential:v1";
export const CREDENTIAL_KEY_VERSION = "pii:v1";

const algorithm = "aes-256-gcm" as const;

export type CredentialEnvelopeContext = {
  tenantId: string;
  provider: string;
};

type CredentialEnvelope = {
  version: typeof CREDENTIAL_ENVELOPE_VERSION;
  algorithm: typeof algorithm;
  keyVersion: typeof CREDENTIAL_KEY_VERSION;
  iv: string;
  tag: string;
  ciphertext: string;
};

export class CredentialEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialEnvelopeError";
  }
}

export function encryptCredentialPayload(
  payload: Record<string, unknown>,
  context: CredentialEnvelopeContext,
  env: Pick<ServerEnv, "PII_ENCRYPTION_KEY">,
): string {
  const key = deriveEnvelopeKey(env.PII_ENCRYPTION_KEY);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);

  cipher.setAAD(buildAdditionalData(context));

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: CredentialEnvelope = {
    version: CREDENTIAL_ENVELOPE_VERSION,
    algorithm,
    keyVersion: CREDENTIAL_KEY_VERSION,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };

  return JSON.stringify(envelope);
}

export function decryptCredentialPayload<TPayload>(
  encryptedPayload: string,
  context: CredentialEnvelopeContext,
  env: Pick<ServerEnv, "PII_ENCRYPTION_KEY">,
): TPayload {
  const envelope = parseEnvelope(encryptedPayload);
  const key = deriveEnvelopeKey(env.PII_ENCRYPTION_KEY);
  const decipher = createDecipheriv(
    envelope.algorithm,
    key,
    Buffer.from(envelope.iv, "base64url"),
  );

  decipher.setAAD(buildAdditionalData(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as TPayload;
}

function deriveEnvelopeKey(secret: string | undefined): Buffer {
  if (!secret) {
    throw new CredentialEnvelopeError("PII_ENCRYPTION_KEY is required");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

function buildAdditionalData(context: CredentialEnvelopeContext): Buffer {
  return Buffer.from(
    JSON.stringify({
      version: CREDENTIAL_ENVELOPE_VERSION,
      keyVersion: CREDENTIAL_KEY_VERSION,
      tenantId: context.tenantId,
      provider: context.provider,
    }),
    "utf8",
  );
}

function parseEnvelope(encryptedPayload: string): CredentialEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(encryptedPayload);
  } catch {
    throw new CredentialEnvelopeError("Credential envelope is not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as CredentialEnvelope).version !== CREDENTIAL_ENVELOPE_VERSION ||
    (parsed as CredentialEnvelope).algorithm !== algorithm ||
    (parsed as CredentialEnvelope).keyVersion !== CREDENTIAL_KEY_VERSION ||
    typeof (parsed as CredentialEnvelope).iv !== "string" ||
    typeof (parsed as CredentialEnvelope).tag !== "string" ||
    typeof (parsed as CredentialEnvelope).ciphertext !== "string"
  ) {
    throw new CredentialEnvelopeError("Credential envelope version is not supported");
  }

  return parsed as CredentialEnvelope;
}
