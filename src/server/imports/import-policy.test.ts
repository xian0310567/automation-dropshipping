import { describe, expect, it } from "vitest";
import {
  IMPORT_CHUNK_MAX_ROWS,
  IMPORT_CHUNK_MAX_SECONDS,
  exceedsWorkerMigrationImportThreshold,
  shouldStopImportChunk,
} from "./import-policy";

describe("import policy", () => {
  it("limits parser chunks to 500 rows or 30 seconds", () => {
    expect(IMPORT_CHUNK_MAX_ROWS).toBe(500);
    expect(IMPORT_CHUNK_MAX_SECONDS).toBe(30);
    expect(shouldStopImportChunk({ processedRows: 500, elapsedSeconds: 1 })).toBe(
      true,
    );
    expect(shouldStopImportChunk({ processedRows: 10, elapsedSeconds: 31 })).toBe(
      true,
    );
    expect(shouldStopImportChunk({ processedRows: 10, elapsedSeconds: 10 })).toBe(
      false,
    );
  });

  it("triggers worker migration review for recurring imports over 50MB or 100k rows", () => {
    expect(
      exceedsWorkerMigrationImportThreshold({
        byteSize: 50 * 1024 * 1024 + 1,
        rowCount: 1,
      }),
    ).toBe(true);
    expect(
      exceedsWorkerMigrationImportThreshold({
        byteSize: 1,
        rowCount: 100_001,
      }),
    ).toBe(true);
  });
});
