import { describe, expect, it } from "vitest";
import { buildCompletedUploadValues } from "./metadata";

describe("buildCompletedUploadValues", () => {
  it("creates retained upload metadata with a 30 day raw retention deadline", () => {
    expect(
      buildCompletedUploadValues({
        blob: {
          url: "https://blob.vercel-storage.com/imports/wing.csv",
          pathname: "imports/wing.csv",
          contentType: "text/csv",
          etag: "etag-1",
        },
        tokenPayload: JSON.stringify({
          uploadedByActorId: "actor-1",
        }),
        verifiedByteSize: 123,
        now: new Date("2026-05-14T00:00:00.000Z"),
      }),
    ).toMatchObject({
      kind: "wing_import",
      blobKey: "imports/wing.csv",
      filename: "wing.csv",
      byteSize: 123,
      checksum: "etag-1",
      status: "uploaded",
      retentionDeadline: new Date("2026-06-13T00:00:00.000Z"),
    });
  });

  it("fails loudly when the signed upload token payload is malformed", () => {
    expect(() =>
      buildCompletedUploadValues({
        blob: {
          url: "https://blob.vercel-storage.com/imports/wing.csv",
          pathname: "imports/wing.csv",
          etag: "etag-1",
        },
        tokenPayload: "{not-json",
        verifiedByteSize: 0,
      }),
    ).toThrow(/invalid upload token payload/i);
  });

  it("requires signed upload token payload for audit attribution", () => {
    expect(() =>
      buildCompletedUploadValues({
        blob: {
          url: "https://blob.vercel-storage.com/imports/wing.csv",
          pathname: "imports/wing.csv",
          etag: "etag-1",
        },
        verifiedByteSize: 0,
      }),
    ).toThrow(/missing upload token payload/i);
  });
});
