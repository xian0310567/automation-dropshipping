import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeOperatorRequest } from "@/server/auth/operator";
import { createDb } from "@/server/db/client";
import { uploads } from "@/server/db/schema";
import { assertUploadEnv } from "@/server/env";
import { buildCompletedUploadValues } from "@/server/uploads/metadata";
import { buildUploadTokenPolicy } from "@/server/uploads/policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const operator =
    body.type === "blob.generate-client-token"
      ? authorizeOperatorRequest(request)
      : null;

  if (operator && !operator.ok) {
    return Response.json({ error: operator.message }, { status: operator.status });
  }

  const jsonResponse = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname) => {
      assertUploadEnv();

      if (!operator?.ok) {
        throw new Error("Operator authorization is required");
      }

      return buildUploadTokenPolicy({
        pathname,
        actorId: operator.actor.id,
      });
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const verified = await head(blob.pathname);
      await createDb()
        .insert(uploads)
        .values(
          buildCompletedUploadValues({
            blob,
            tokenPayload,
            verifiedByteSize: verified.size,
          }),
        );
    },
  });

  return Response.json(jsonResponse);
}
