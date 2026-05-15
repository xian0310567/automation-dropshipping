import { z } from "zod";
import { authorizeProtectedRequest } from "@/server/auth/protected-request";
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
  const auth = await authorizeProtectedRequest(request, "review_candidate");
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
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
      actorId: auth.context.actor.id,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  });
}
