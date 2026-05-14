export const IMPORT_CHUNK_MAX_ROWS = 500;
export const IMPORT_CHUNK_MAX_SECONDS = 30;
export const IMPORT_WORKER_MIGRATION_BYTES = 50 * 1024 * 1024;
export const IMPORT_WORKER_MIGRATION_ROWS = 100_000;

export function shouldStopImportChunk(input: {
  processedRows: number;
  elapsedSeconds: number;
}): boolean {
  return (
    input.processedRows >= IMPORT_CHUNK_MAX_ROWS ||
    input.elapsedSeconds >= IMPORT_CHUNK_MAX_SECONDS
  );
}

export function exceedsWorkerMigrationImportThreshold(input: {
  byteSize: number;
  rowCount: number;
}): boolean {
  return (
    input.byteSize > IMPORT_WORKER_MIGRATION_BYTES ||
    input.rowCount > IMPORT_WORKER_MIGRATION_ROWS
  );
}
