import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeProtectedRequest } from "@/server/auth/protected-request";
import { createDb } from "@/server/db/client";
import { uploads } from "@/server/db/schema";
import { assertUploadEnv } from "@/server/env";
import { buildCompletedUploadValues } from "@/server/uploads/metadata";
import { buildUploadTokenPolicy } from "@/server/uploads/policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const auth =
    body.type === "blob.generate-client-token"
      ? await authorizeUploadTokenRequest(request)
      : null;

  if (auth && !auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const jsonResponse = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname) => {
      if (!auth?.ok) {
        throw new Error("Authorization is required");
      }

      return buildUploadTokenPolicy({
        pathname,
        actorId: auth.context.actor.id,
        tenantId: auth.context.tenant?.tenantId,
        userId:
          auth.context.source === "session" ? auth.context.actor.id : undefined,
        authSubjectId: auth.context.tenant?.authSubjectId,
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

async function authorizeUploadTokenRequest(request: Request) {
  try {
    assertUploadEnv();
  } catch (error) {
    return {
      ok: false as const,
      status: 503 as const,
      message:
        error instanceof Error ? error.message : "Upload env is not configured",
    };
  }

  return authorizeProtectedRequest(request, "upload_file", {
    db: createDb(),
    requireLocalIdentity: true,
  });
}
