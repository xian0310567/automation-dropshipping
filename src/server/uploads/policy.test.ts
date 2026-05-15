import { describe, expect, it } from "vitest";
import { buildUploadTokenPolicy } from "./policy";

describe("buildUploadTokenPolicy", () => {
  it("limits WING uploads to private CSV/XLSX imports under the migration threshold", () => {
    const policy = buildUploadTokenPolicy({
      pathname: "imports/wing.csv",
      actorId: "actor-1",
      tenantId: "tenant-1",
      userId: "user-1",
      authSubjectId: "dev:operator@example.com",
      now: new Date("2026-05-14T00:00:00.000Z"),
    });

    expect(policy.allowedContentTypes).toEqual([
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    expect(policy.maximumSizeInBytes).toBe(50 * 1024 * 1024);
    expect(policy.validUntil).toBe(new Date("2026-05-14T00:15:00.000Z").getTime());
    expect(policy.tokenPayload).toContain("actor-1");
    expect(policy.tokenPayload).toContain("tenant-1");
    expect(policy.tokenPayload).toContain("dev:operator@example.com");
  });
});
