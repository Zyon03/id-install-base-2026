import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  parseInstallBaseWorkbook,
  serializeInstallBaseWorkbook,
  type CustomerGroupExport,
} from "@/lib/xlsx";

/**
 * Builds a workbook matching the source sheet's layout (grouped section
 * header row 1, field label row 2, data from row 3) from plain row arrays.
 * Values are synthetic — never real customer data — but the row patterns
 * mirror real quirks found in the source sheet: a continuation row that
 * blanks most customer fields, a row with no customer name at all (like
 * real row 60), and a numeric-typed serial number (like real row 4).
 */
async function buildFixtureWorkbook(rows: (string | number | null)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const sectionRow = sheet.getRow(1);
  const labelRow = sheet.getRow(2);
  let lastSection: string | null = null;
  COLUMNS.forEach((col, i) => {
    if (col.section !== lastSection) {
      sectionRow.getCell(i + 1).value = col.section;
      lastSection = col.section;
    }
    labelRow.getCell(i + 1).value = col.header;
  });

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(rowIndex + 3);
    row.forEach((value, colIndex) => {
      excelRow.getCell(colIndex + 1).value = value;
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function emptyRow(): (string | number | null)[] {
  return new Array(COLUMNS.length).fill(null);
}

function setCol(row: (string | number | null)[], header: string, value: string | number): void {
  const index = COLUMNS.findIndex((c) => c.header === header);
  if (index === -1) throw new Error(`Unknown column header: ${header}`);
  row[index] = value;
}

describe("parseInstallBaseWorkbook", () => {
  it("groups contiguous rows by customer, inheriting blank customer fields within a group", async () => {
    const anchorRow = emptyRow();
    setCol(anchorRow, "Customer", "Acme Testing Co");
    setCol(anchorRow, "Address", "1 Fake Street");
    setCol(anchorRow, "Region", "Testville");
    setCol(anchorRow, "Main contact 1", "Ms. Example");
    setCol(anchorRow, "Model", "Model A");
    setCol(anchorRow, "Serial Number", "SN-STRING-001");

    const continuationRow = emptyRow();
    setCol(continuationRow, "Customer", "Acme Testing Co");
    setCol(continuationRow, "Model", "Model B");
    // Real sheet has numeric-typed serials on some rows (e.g. row 4) even
    // though the field is conceptually text — must coerce to string.
    setCol(continuationRow, "Serial Number", 30044395010);

    const buffer = await buildFixtureWorkbook([anchorRow, continuationRow]);
    const groups = await parseInstallBaseWorkbook(buffer);

    expect(groups).toHaveLength(1);
    expect(groups[0].customer).toMatchObject({
      name: "Acme Testing Co",
      address: "1 Fake Street",
      region: "Testville",
      mainContact: "Ms. Example",
    });
    expect(groups[0].equipment).toHaveLength(2);
    expect(groups[0].equipment[0].model).toBe("Model A");
    expect(groups[0].equipment[0].serialNumber).toBe("SN-STRING-001");
    expect(groups[0].equipment[1].model).toBe("Model B");
    expect(groups[0].equipment[1].serialNumber).toBe("30044395010");
  });

  it("treats a row with a blank customer name as a continuation of the previous group", async () => {
    const anchorRow = emptyRow();
    setCol(anchorRow, "Customer", "Beta Testing Ltd");
    setCol(anchorRow, "Address", "2 Fake Street");
    setCol(anchorRow, "Region", "Testville");

    // Mirrors real row 60: no customer name, but has address/region and no
    // equipment fields at all.
    const blankNameRow = emptyRow();
    setCol(blankNameRow, "Address", "3 Fake Street");
    setCol(blankNameRow, "Region", "Testville North");

    const buffer = await buildFixtureWorkbook([anchorRow, blankNameRow]);
    const groups = await parseInstallBaseWorkbook(buffer);

    expect(groups).toHaveLength(1);
    // First-seen value wins — the anchor row's address isn't overwritten by
    // the continuation row's (different) address.
    expect(groups[0].customer.address).toBe("2 Fake Street");
    expect(groups[0].equipment).toHaveLength(2);
    expect(groups[0].equipment[1].model).toBeNull();
  });

  it("starts a new group when a differently-named customer row appears", async () => {
    const rowA = emptyRow();
    setCol(rowA, "Customer", "Acme Testing Co");
    setCol(rowA, "Address", "1 Fake Street");

    const rowB = emptyRow();
    setCol(rowB, "Customer", "Beta Testing Ltd");
    setCol(rowB, "Address", "2 Fake Street");

    const buffer = await buildFixtureWorkbook([rowA, rowB]);
    const groups = await parseInstallBaseWorkbook(buffer);

    expect(groups).toHaveLength(2);
    expect(groups[0].customer.name).toBe("Acme Testing Co");
    expect(groups[1].customer.name).toBe("Beta Testing Ltd");
  });

  it("parses numeric and date fields", async () => {
    const row = emptyRow();
    setCol(row, "Customer", "Acme Testing Co");
    setCol(row, "Motor KW", 7.5);
    setCol(row, "Year Installed", 2019);
    setCol(row, "End Date", "2025-01-15");

    const buffer = await buildFixtureWorkbook([row]);
    const groups = await parseInstallBaseWorkbook(buffer);

    expect(groups[0].equipment[0].motorKw).toBe(7.5);
    expect(groups[0].equipment[0].yearInstalled).toBe(2019);
    expect(groups[0].customer.psaEndDate).toBeInstanceOf(Date);
  });

  it("extracts plain text from hyperlinked cells instead of stringifying the object", async () => {
    // exceljs represents a mailto:-hyperlinked cell as { text, hyperlink }, not a plain
    // string — the real sheet's Email column has these (e.g. row 71's
    // Ari.Subic@simp.co.id). Naively calling String(value) on that object yields the
    // literal text "[object Object]".
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    COLUMNS.forEach((col, i) => {
      sheet.getRow(2).getCell(i + 1).value = col.header;
    });
    const customerColIndex = COLUMNS.findIndex((c) => c.header === "Customer") + 1;
    sheet.getRow(3).getCell(customerColIndex).value = "Acme Testing Co";
    const emailColIndex = COLUMNS.findIndex((c) => c.header === "Email") + 1;
    sheet.getRow(3).getCell(emailColIndex).value = {
      text: "person@example.com",
      hyperlink: "mailto:person@example.com",
    };

    const groups = await parseInstallBaseWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));

    expect(groups[0].customer.email).toBe("person@example.com");
    expect(groups[0].customer.email).not.toContain("object Object");
  });

  it("throws a descriptive error when the header row doesn't match the expected layout", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.getRow(2).getCell(2).value = "Wrong Header";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseInstallBaseWorkbook(buffer)).rejects.toThrow(/Customer/);
  });
});

describe("serializeInstallBaseWorkbook", () => {
  it("round-trips: parse -> serialize -> parse yields equivalent data", async () => {
    const anchorRow = emptyRow();
    setCol(anchorRow, "Customer", "Acme Testing Co");
    setCol(anchorRow, "Address", "1 Fake Street");
    setCol(anchorRow, "Region", "Testville");
    setCol(anchorRow, "Model", "Model A");
    setCol(anchorRow, "Motor KW", 5.5);

    const continuationRow = emptyRow();
    setCol(continuationRow, "Customer", "Acme Testing Co");
    setCol(continuationRow, "Model", "Model B");

    const originalBuffer = await buildFixtureWorkbook([anchorRow, continuationRow]);
    const parsed = await parseInstallBaseWorkbook(originalBuffer);

    const exportGroups: CustomerGroupExport[] = parsed.map((g, i) => ({
      customer: { ...g.customer, no: i + 1 },
      equipment: g.equipment,
    }));

    const serialized = await serializeInstallBaseWorkbook(exportGroups);
    const reparsed = await parseInstallBaseWorkbook(Buffer.from(serialized));

    expect(reparsed).toHaveLength(1);
    expect(reparsed[0].customer).toMatchObject({
      name: "Acme Testing Co",
      address: "1 Fake Street",
      region: "Testville",
    });
    expect(reparsed[0].equipment).toHaveLength(2);
    expect(reparsed[0].equipment[0].model).toBe("Model A");
    expect(reparsed[0].equipment[0].motorKw).toBe(5.5);
    expect(reparsed[0].equipment[1].model).toBe("Model B");
    // Export denormalizes: every row gets the full customer record, unlike
    // the source's blank-after-first-row convention.
    expect(reparsed[0].equipment).toHaveLength(2);
  });
});
