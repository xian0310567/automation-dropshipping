export type RetentionKind =
  | "raw_upload"
  | "raw_api_payload"
  | "redacted_operational_log"
  | "audit_log";

export type RetentionAction = "keep" | "delete_raw" | "mask_raw";

const dayMs = 24 * 60 * 60 * 1000;

const retentionDays: Record<RetentionKind, number> = {
  raw_upload: 30,
  raw_api_payload: 14,
  redacted_operational_log: 90,
  audit_log: 365,
};

export function getRetentionAction(input: {
  kind: RetentionKind;
  createdAt: Date;
  now?: Date;
}): RetentionAction {
  const now = input.now ?? new Date();
  const ageDays =
    (now.getTime() - input.createdAt.getTime()) / dayMs;

  if (ageDays <= retentionDays[input.kind]) {
    return "keep";
  }

  if (input.kind === "audit_log" || input.kind === "redacted_operational_log") {
    return "keep";
  }

  return input.kind === "raw_api_payload" ? "mask_raw" : "delete_raw";
}
