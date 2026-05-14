import { z } from "zod";
import { authorizeOperatorRequest } from "@/server/auth/operator";
import { buildApprovalHash } from "@/server/approvals/approval";
import { createDb } from "@/server/db/client";
import { approvals, auditLogs } from "@/server/db/schema";
import { assertMutationEnv } from "@/server/env";
import { canPerformAction } from "@/server/rbac/policy";

export const runtime = "nodejs";

const createApprovalSchema = z.object({
  actionType: z.string().min(1),
  vendorId: z.string().min(1),
  targetIds: z.record(z.string(), z.string()),
  payload: z.record(z.string(), z.unknown()),
  sourceImportId: z.string().optional(),
  riskFlags: z.array(z.string()).default([]),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const operator = authorizeOperatorRequest(request);
  if (!operator.ok) {
    return Response.json({ error: operator.message }, { status: operator.status });
  }

  const parsed = createApprovalSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (
    !canPerformAction({
      role: operator.actor.role,
      action: "review_candidate",
    })
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const approvalHash = buildApprovalHash({
    actionType: parsed.data.actionType,
    vendorId: parsed.data.vendorId,
    actorId: operator.actor.id,
    targetIds: parsed.data.targetIds,
    payload: parsed.data.payload,
    sourceImportId: parsed.data.sourceImportId,
    riskFlags: parsed.data.riskFlags,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    requestVersion: 1,
  });
  try {
    assertMutationEnv();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Mutation env is not configured" },
      { status: 503 },
    );
  }

  const db = createDb();
  const approval = await db.transaction(async (tx) => {
    const [createdApproval] = await tx
      .insert(approvals)
      .values({
        state: "pending_approval",
        actionType: parsed.data.actionType,
        vendorId: parsed.data.vendorId,
        targetIds: parsed.data.targetIds,
        payload: parsed.data.payload,
        approvalHash,
        requestedByActorId: operator.actor.id,
        reason: parsed.data.reason,
        expiresAt,
      })
      .returning({
        id: approvals.id,
      });

    if (!createdApproval) {
      throw new Error("Failed to create approval");
    }

    await tx.insert(auditLogs).values({
      eventType: "approval.created",
      actorId: operator.actor.id,
      approvalId: createdApproval.id,
      previousState: "candidate",
      nextState: "pending_approval",
      requestHash: approvalHash,
      reason: parsed.data.reason ?? "Approval requested",
      metadata: {
        targetIds: parsed.data.targetIds,
        riskFlags: parsed.data.riskFlags,
        sourceImportId: parsed.data.sourceImportId,
      },
    });

    return createdApproval;
  });

  return Response.json(
    {
      id: approval.id,
      state: "pending_approval",
      approvalHash,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 201 },
  );
}
