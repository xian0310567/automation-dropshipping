import { describe, expect, it } from "vitest";
import { parseWingCsv, parseWingXlsx, toWingImportChunk } from "./wing-parser";

describe("parseWingCsv", () => {
  it("normalizes WING CSV rows and records validation errors", () => {
    const rows = parseWingCsv(`sellerProductId,vendorItemId,productName,nonWinnerDays,status
SP-1,VI-1,Sample product,3,ON_SALE
,VI-2,Missing seller product,1,ON_SALE`);

    expect(rows).toEqual([
      {
        rowNumber: 2,
        normalized: {
          sellerProductId: "SP-1",
          vendorItemId: "VI-1",
          productName: "Sample product",
          nonWinnerDays: 3,
          status: "ON_SALE",
        },
        validationErrors: [],
      },
      {
        rowNumber: 3,
        normalized: {
          sellerProductId: "",
          vendorItemId: "VI-2",
          productName: "Missing seller product",
          nonWinnerDays: 1,
          status: "ON_SALE",
        },
        validationErrors: ["sellerProductId is required"],
      },
    ]);
  });

  it("chunks parsed rows by policy max rows", () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      rowNumber: index + 2,
      normalized: {
        sellerProductId: `SP-${index}`,
        vendorItemId: `VI-${index}`,
        productName: "Product",
        nonWinnerDays: 3,
        status: "ON_SALE",
      },
      validationErrors: [],
    }));

    expect(toWingImportChunk(rows, { startIndex: 0 }).rows).toHaveLength(500);
    expect(toWingImportChunk(rows, { startIndex: 500 }).rows).toHaveLength(1);
  });
});

describe("parseWingXlsx", () => {
  it("parses xlsx buffers with the same normalized shape", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("wing");
    sheet.addRow([
      "sellerProductId",
      "vendorItemId",
      "productName",
      "nonWinnerDays",
      "status",
    ]);
    sheet.addRow(["SP-9", "VI-9", "Workbook row", 4, "ON_SALE"]);

    const buffer = await workbook.xlsx.writeBuffer();
    const rows = await parseWingXlsx(Buffer.from(buffer));

    expect(rows[0]?.normalized).toMatchObject({
      sellerProductId: "SP-9",
      vendorItemId: "VI-9",
      productName: "Workbook row",
      nonWinnerDays: 4,
    });
  });
});
