import {
  buildApprovalHash,
  type ApprovalHashPayload,
  type ApprovalState,
} from "@/server/approvals/approval";
import { createJobIdempotencyKey } from "@/server/jobs/job-policy";
import {
  generateNonWinnerCandidates,
  type NonWinnerCandidate,
} from "@/server/imports/non-winner-candidates";
import type { WingNormalizedRow } from "@/server/imports/wing-parser";

export type PreparedNonWinnerApproval = NonWinnerCandidate & {
  approvalState: ApprovalState;
  approvalHash: string;
  idempotencyKey: string;
  approvalPayload: ApprovalHashPayload;
};

export function prepareNonWinnerApprovalBatch(input: {
  vendorId: string;
  actorId: string;
  sourceImportId: string;
  createdAt: string;
  expiresAt: string;
  rows: readonly WingNormalizedRow[];
}): PreparedNonWinnerApproval[] {
  return generateNonWinnerCandidates({
    vendorId: input.vendorId,
    sourceImportId: input.sourceImportId,
    importedRows: input.rows,
  }).map((candidate) => {
    const approvalPayload: ApprovalHashPayload = {
      actionType: candidate.actionType,
      vendorId: input.vendorId,
      actorId: input.actorId,
      targetIds: {
        sellerProductId: candidate.sellerProductId,
        vendorItemId: candidate.vendorItemId,
      },
      payload: {
        targetState: "stopped",
        reason: candidate.reason,
      },
      sourceImportId: input.sourceImportId,
      riskFlags: candidate.riskFlags,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      requestVersion: 1,
    };
    const approvalHash = buildApprovalHash(approvalPayload);
    const idempotencyKey = createJobIdempotencyKey({
      vendorId: input.vendorId,
      actionType: candidate.actionType,
      targetId: candidate.vendorItemId,
      approvalId: approvalHash,
      approvalHash,
      targetState: "stopped",
    });

    return {
      ...candidate,
      approvalState: "pending_approval",
      approvalHash,
      idempotencyKey,
      approvalPayload,
    };
  });
}
