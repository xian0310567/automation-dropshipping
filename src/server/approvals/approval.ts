import { createHash } from "node:crypto";

export type ApprovalState =
  | "candidate"
  | "pending_approval"
  | "approved"
  | "executing"
  | "succeeded"
  | "failed"
  | "reverted"
  | "expired"
  | "rejected";

export type ApprovalHashPayload = {
  actionType: string;
  vendorId: string;
  actorId: string;
  targetIds: Record<string, string>;
  payload: Record<string, unknown>;
  sourceImportId?: string;
  riskFlags: readonly string[];
  createdAt: string;
  expiresAt: string;
  requestVersion: number;
};

type TransitionInput = {
  approvalId: string;
  from: ApprovalState;
  to: ApprovalState;
  actorId: string;
  reason: string;
};

export type ApprovalAuditEvent = {
  eventType: string;
  approvalId: string;
  actorId: string;
  previousState: ApprovalState;
  nextState: ApprovalState;
  reason: string;
  createdAt: string;
};

const allowedTransitions: Record<ApprovalState, ApprovalState[]> = {
  candidate: ["pending_approval", "expired", "rejected"],
  pending_approval: ["approved", "expired", "rejected"],
  approved: ["executing", "expired"],
  executing: ["succeeded", "failed"],
  succeeded: ["reverted"],
  failed: ["pending_approval"],
  reverted: [],
  expired: [],
  rejected: [],
};

export function buildApprovalHash(payload: ApprovalHashPayload): string {
  const normalized = normalizeForHash(payload);

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function canExecuteApproval(input: { state: ApprovalState }): boolean {
  return input.state === "approved";
}

export function transitionApproval(input: TransitionInput): ApprovalAuditEvent {
  if (!allowedTransitions[input.from].includes(input.to)) {
    throw new Error(`Invalid approval transition: ${input.from} -> ${input.to}`);
  }

  return {
    eventType: "approval.transitioned",
    approvalId: input.approvalId,
    actorId: input.actorId,
    previousState: input.from,
    nextState: input.to,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

export function createApprovalDeniedAudit(input: {
  approvalId: string;
  actorId: string;
  state: ApprovalState;
  reason: string;
}): ApprovalAuditEvent {
  return {
    eventType: "approval.execution_denied",
    approvalId: input.approvalId,
    actorId: input.actorId,
    previousState: input.state,
    nextState: input.state,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeForHash(child)]),
    );
  }

  return value;
}
