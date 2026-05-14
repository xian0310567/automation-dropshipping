export const JOB_LEASE_TTL_MS = 10 * 60 * 1000;
export const JOB_INVOCATION_BUDGET_MS = 240 * 1000;
export const JOB_DEAD_LETTER_ATTEMPTS = 5;
export const JOB_STUCK_MS = 24 * 60 * 60 * 1000;

export function shouldCheckpoint(input: { elapsedMs: number }): boolean {
  return input.elapsedMs >= JOB_INVOCATION_BUDGET_MS;
}

export function hasLeaseExpired(input: {
  leaseExpiresAt: Date;
  now?: Date;
}): boolean {
  return input.leaseExpiresAt.getTime() < (input.now ?? new Date()).getTime();
}

export function shouldDeadLetter(input: {
  attempts: number;
  firstQueuedAt: Date;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return (
    input.attempts >= JOB_DEAD_LETTER_ATTEMPTS ||
    now.getTime() - input.firstQueuedAt.getTime() > JOB_STUCK_MS
  );
}

export function createJobIdempotencyKey(input: {
  vendorId: string;
  actionType: string;
  targetId: string;
  approvalId: string;
  approvalHash: string;
  targetState: string;
}): string {
  return [
    input.vendorId,
    input.actionType,
    input.targetId,
    input.approvalId,
    input.approvalHash,
    input.targetState,
  ].join(":");
}
