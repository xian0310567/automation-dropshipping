import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { IMPORT_CHUNK_MAX_ROWS } from "./import-policy";

export type WingNormalizedRow = {
  sellerProductId: string;
  vendorItemId: string;
  productName: string;
  nonWinnerDays: number;
  status: string;
  hasRecentOrder?: boolean;
  hasOpenClaim?: boolean;
};

export type WingImportRow = {
  rowNumber: number;
  normalized: WingNormalizedRow;
  validationErrors: string[];
};

type RawWingRow = Record<string, unknown>;

const headerAliases = {
  sellerProductId: ["sellerProductId", "seller_product_id", "판매상품ID"],
  vendorItemId: ["vendorItemId", "vendor_item_id", "옵션ID"],
  productName: ["productName", "product_name", "상품명"],
  nonWinnerDays: ["nonWinnerDays", "non_winner_days", "비위너일수"],
  status: ["status", "판매상태"],
} satisfies Record<keyof Omit<WingNormalizedRow, "hasRecentOrder" | "hasOpenClaim">, string[]>;

export function parseWingCsv(csvText: string): WingImportRow[] {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawWingRow[];

  return records.map((record, index) => normalizeRawWingRow(record, index + 2));
}

export async function parseWingXlsx(buffer: Buffer): Promise<WingImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const headers = sheet.getRow(1).values as unknown[];
  const rows: WingImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rawRow: RawWingRow = {};
    row.eachCell((cell, columnNumber) => {
      const header = String(headers[columnNumber] ?? "").trim();
      if (header) {
        rawRow[header] = cell.value;
      }
    });
    rows.push(normalizeRawWingRow(rawRow, rowNumber));
  });

  return rows;
}

export function toWingImportChunk(
  rows: readonly WingImportRow[],
  input: { startIndex: number },
) {
  const nextRows = rows.slice(
    input.startIndex,
    input.startIndex + IMPORT_CHUNK_MAX_ROWS,
  );

  return {
    rows: nextRows,
    nextIndex: input.startIndex + nextRows.length,
    done: input.startIndex + nextRows.length >= rows.length,
  };
}

function normalizeRawWingRow(record: RawWingRow, rowNumber: number): WingImportRow {
  const normalized: WingNormalizedRow = {
    sellerProductId: readString(record, headerAliases.sellerProductId),
    vendorItemId: readString(record, headerAliases.vendorItemId),
    productName: readString(record, headerAliases.productName),
    nonWinnerDays: readNumber(record, headerAliases.nonWinnerDays),
    status: readString(record, headerAliases.status) || "UNKNOWN",
  };

  return {
    rowNumber,
    normalized,
    validationErrors: validateWingRow(normalized),
  };
}

function validateWingRow(row: WingNormalizedRow): string[] {
  const errors: string[] = [];

  if (!row.sellerProductId) {
    errors.push("sellerProductId is required");
  }

  if (!row.vendorItemId) {
    errors.push("vendorItemId is required");
  }

  if (!row.productName) {
    errors.push("productName is required");
  }

  if (!Number.isFinite(row.nonWinnerDays) || row.nonWinnerDays < 0) {
    errors.push("nonWinnerDays must be a non-negative number");
  }

  return errors;
}

function readString(record: RawWingRow, aliases: readonly string[]): string {
  const value = aliases
    .map((alias) => record[alias])
    .find((candidate) => candidate !== undefined && candidate !== null);

  return String(value ?? "").trim();
}

function readNumber(record: RawWingRow, aliases: readonly string[]): number {
  const raw = readString(record, aliases);
  return raw ? Number(raw) : 0;
}
