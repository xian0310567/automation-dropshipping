type CompletedBlob = {
  url: string;
  pathname: string;
  contentType?: string;
  etag: string;
};

type UploadTokenPayload = {
  tenantId?: string;
  uploadedByActorId?: string;
  uploadedByUserId?: string;
  uploadedByAuthSubjectId?: string;
};

export function buildCompletedUploadValues(input: {
  blob: CompletedBlob;
  tokenPayload?: string | null;
  verifiedByteSize: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const parsedPayload = parseTokenPayload(input.tokenPayload);
  const filename = input.blob.pathname.split("/").at(-1) || input.blob.pathname;

  return {
    kind: "wing_import",
    status: "uploaded" as const,
    blobUrl: input.blob.url,
    blobKey: input.blob.pathname,
    filename,
    contentType: input.blob.contentType,
    byteSize: input.verifiedByteSize,
    checksum: input.blob.etag,
    tenantId: parsedPayload.tenantId,
    uploadedByActorId: parsedPayload.uploadedByActorId,
    uploadedByUserId: parsedPayload.uploadedByUserId,
    uploadedByAuthSubjectId: parsedPayload.uploadedByAuthSubjectId,
    retentionDeadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  };
}

function parseTokenPayload(tokenPayload?: string | null): UploadTokenPayload {
  if (!tokenPayload) {
    throw new Error("Missing upload token payload");
  }

  try {
    return JSON.parse(tokenPayload) as UploadTokenPayload;
  } catch {
    throw new Error("Invalid upload token payload");
  }
}
