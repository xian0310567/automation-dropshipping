import { IMPORT_WORKER_MIGRATION_BYTES } from "@/server/imports/import-policy";

const allowedWingContentTypes = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function buildUploadTokenPolicy(input: {
  pathname: string;
  actorId: string;
  tenantId?: string;
  userId?: string;
  authSubjectId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (!input.pathname.startsWith("imports/")) {
    throw new Error("Uploads must target the imports/ namespace");
  }

  return {
    allowedContentTypes: allowedWingContentTypes,
    maximumSizeInBytes: IMPORT_WORKER_MIGRATION_BYTES,
    validUntil: now.getTime() + 15 * 60 * 1000,
    addRandomSuffix: true,
    allowOverwrite: false,
    tokenPayload: JSON.stringify({
      kind: "wing_import",
      requestedPathname: input.pathname,
      uploadedByActorId: input.actorId,
      tenantId: input.tenantId,
      uploadedByUserId: input.userId,
      uploadedByAuthSubjectId: input.authSubjectId,
    }),
  };
}
