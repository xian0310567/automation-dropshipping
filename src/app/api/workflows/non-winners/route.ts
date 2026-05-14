import { z } from "zod";
import { authorizeOperatorRequest } from "@/server/auth/operator";
import { canPerformAction } from "@/server/rbac/policy";
import { prepareNonWinnerApprovalBatch } from "@/server/workflows/non-winners/prepare";

export const runtime = "nodejs";

const rowSchema = z.object({
  sellerProductId: z.string(),
  vendorItemId: z.string(),
  productName: z.string(),
  nonWinnerDays: z.number(),
  status: z.string(),
  hasRecentOrder: z.boolean().optional(),
  hasOpenClaim: z.boolean().optional(),
});

const requestSchema = z.object({
  vendorId: z.string().min(1),
  sourceImportId: z.string().min(1),
  rows: z.array(rowSchema),
});

export async function POST(request: Request) {
  const operator = authorizeOperatorRequest(request);
  if (!operator.ok) {
    return Response.json({ error: operator.message }, { status: operator.status });
  }

  if (
    !canPerformAction({
      role: operator.actor.role,
      action: "review_candidate",
    })
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  return Response.json({
    approvals: prepareNonWinnerApprovalBatch({
      ...parsed.data,
      actorId: operator.actor.id,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  });
}
