import {
  canExecuteApproval,
  createApprovalDeniedAudit,
  transitionApproval,
  type ApprovalAuditEvent,
  type ApprovalState,
} from "@/server/approvals/approval";
import { createJobIdempotencyKey } from "@/server/jobs/job-policy";

export type NonWinnerExecutionApproval = {
  id: string;
  state: ApprovalState;
  actionType: "sales_stop";
  vendorId: string;
  approvalHash: string;
  targetId: string;
};

export type NonWinnerMutationSubmitter = (input: {
  approval: NonWinnerExecutionApproval;
  idempotencyKey: string;
}) => Promise<{ providerRequestId: string }>;

export type NonWinnerExecutionResult =
  | {
      status: "denied";
      audit: ApprovalAuditEvent;
    }
  | {
      status: "submitted";
      providerRequestId: string;
      audit: ApprovalAuditEvent;
    };

export async function executeApprovedNonWinnerMutation(input: {
  approval: NonWinnerExecutionApproval;
  actorId: string;
  idempotencyKey?: string;
  submitMutation: NonWinnerMutationSubmitter;
}): Promise<NonWinnerExecutionResult> {
  if (!canExecuteApproval({ state: input.approval.state })) {
    return {
      status: "denied",
      audit: createApprovalDeniedAudit({
        approvalId: input.approval.id,
        actorId: input.actorId,
        state: input.approval.state,
        reason: "Approval is not executable",
      }),
    };
  }

  const idempotencyKey =
    input.idempotencyKey ??
    createJobIdempotencyKey({
      vendorId: input.approval.vendorId,
      actionType: input.approval.actionType,
      targetId: input.approval.targetId,
      approvalId: input.approval.id,
      approvalHash: input.approval.approvalHash,
      targetState: "stopped",
    });

  const response = await input.submitMutation({
    approval: input.approval,
    idempotencyKey,
  });

  return {
    status: "submitted",
    providerRequestId: response.providerRequestId,
    audit: transitionApproval({
      approvalId: input.approval.id,
      from: "approved",
      to: "executing",
      actorId: input.actorId,
      reason: "Submitting approved non-winner mutation",
    }),
  };
}
