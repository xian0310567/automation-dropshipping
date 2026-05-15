import { z } from "zod";
import { authorizeProtectedRequest } from "@/server/auth/protected-request";
import { buildApprovalHash } from "@/server/approvals/approval";
import { createDb } from "@/server/db/client";
import { approvals, auditLogs } from "@/server/db/schema";
import { assertApprovalEnv } from "@/server/env";
import { tenantAuditActor } from "@/server/tenancy/context";

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
  try {
    assertApprovalEnv();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Approval env is not configured",
      },
      { status: 503 },
    );
  }

  const db = createDb();
  const auth = await authorizeProtectedRequest(request, "review_candidate", {
    db,
    requireLocalIdentity: true,
  });

  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const parsed = createApprovalSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const { actor, tenant } = auth.context;
  const approvalHash = buildApprovalHash({
    actionType: parsed.data.actionType,
    vendorId: parsed.data.vendorId,
    actorId: actor.id,
    targetIds: parsed.data.targetIds,
    payload: parsed.data.payload,
    sourceImportId: parsed.data.sourceImportId,
    riskFlags: parsed.data.riskFlags,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    requestVersion: 1,
  });
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
        tenantId: tenant?.tenantId,
        requestedByActorId:
          auth.context.source === "operator" ? actor.id : undefined,
        requestedByUserId:
          auth.context.source === "session" ? actor.id : undefined,
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
      ...(tenant ? tenantAuditActor(tenant) : {}),
      actorId: auth.context.source === "operator" ? actor.id : undefined,
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
