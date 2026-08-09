import ExcelJS from "exceljs";

export type CustomerInput = {
  name: string;
  bpNumber: string | null;
  uniqueIdentifier: string | null;
  address: string | null;
  region: string | null;
  territory: string | null;
  mainContact: string | null;
  contactNumber: string | null;
  email: string | null;
  location: string | null;
  fnbOrYps: string | null;
  psaStatus: string | null;
  psaContract: string | null;
  psaEndDate: Date | null;
  salesRep: string | null;
  opsTeam: string | null;
};

export type EquipmentInput = {
  equipTag: string | null;
  model: string | null;
  compressorType: string | null;
  serialNumber: string | null;
  brand: string | null;
  motorMakeModel: string | null;
  motorSerial: string | null;
  motorKw: number | null;
  yearInstalled: number | null;
  yearCommissioned: number | null;
  runningHours: number | null;
  lastServiceDate: Date | null;
  comments: string | null;
  areaClassification: string | null;
  equipmentSalesPerson: string | null;
  controllerType: string | null;
  oilType: string | null;
  oilCharge: string | null;
  refType: string | null;
  refCharge: string | null;
  detailedComments: string | null;
  thirdPartyCompressorModel: string | null;
  thirdPartyRunHours: number | null;
  thirdPartyPsaContract: string | null;
  condenserMakeModel: string | null;
  ammoniaPumpMakeModel: string | null;
};

export type CustomerGroup = {
  customer: CustomerInput;
  equipment: EquipmentInput[];
};

export type CustomerExport = CustomerInput & { no: number };

export type CustomerGroupExport = {
  customer: CustomerExport;
  equipment: EquipmentInput[];
};

type FieldType = "string" | "int" | "float" | "date";

type ColumnDef = {
  section: string;
  header: string;
  target: "customerNo" | "customer" | "equipment";
  field: string;
  type: FieldType;
};

const HEADER_SECTION_ROW = 1;
const HEADER_LABEL_ROW = 2;
const DATA_START_ROW = 3;

// Single source of truth for both parse and serialize directions. Order
// matches the source sheet's 43 columns exactly.
export const COLUMNS: ColumnDef[] = [
  { section: "Contact information", header: "No.", target: "customerNo", field: "no", type: "int" },
  { section: "Contact information", header: "Customer", target: "customer", field: "name", type: "string" },
  { section: "Contact information", header: "BP Number", target: "customer", field: "bpNumber", type: "string" },
  { section: "Contact information", header: "Unique Identifier ()", target: "customer", field: "uniqueIdentifier", type: "string" },
  { section: "Contact information", header: "Address", target: "customer", field: "address", type: "string" },
  { section: "Contact information", header: "Region", target: "customer", field: "region", type: "string" },
  { section: "Contact information", header: "Territory", target: "customer", field: "territory", type: "string" },
  { section: "Contact information", header: "Main contact 1", target: "customer", field: "mainContact", type: "string" },
  { section: "Contact information", header: "Contact number", target: "customer", field: "contactNumber", type: "string" },
  { section: "Contact information", header: "Email", target: "customer", field: "email", type: "string" },
  { section: "Contact information", header: "Location", target: "customer", field: "location", type: "string" },
  { section: "Contact information", header: "F&B / YPS", target: "customer", field: "fnbOrYps", type: "string" },
  { section: "Contact information", header: "With / Without PSA Contract", target: "customer", field: "psaStatus", type: "string" },
  { section: "Contact information", header: "PSA Contract", target: "customer", field: "psaContract", type: "string" },
  { section: "Contact information", header: "End Date", target: "customer", field: "psaEndDate", type: "date" },
  { section: "Internal Information", header: "Sales", target: "customer", field: "salesRep", type: "string" },
  { section: "Internal Information", header: "Ops Team", target: "customer", field: "opsTeam", type: "string" },
  { section: "Equipment", header: "Equip Tag", target: "equipment", field: "equipTag", type: "string" },
  { section: "Equipment", header: "Model", target: "equipment", field: "model", type: "string" },
  { section: "Equipment", header: "Compressor Type", target: "equipment", field: "compressorType", type: "string" },
  { section: "Equipment", header: "Serial Number", target: "equipment", field: "serialNumber", type: "string" },
  { section: "Equipment", header: "Brand (Manufacture)", target: "equipment", field: "brand", type: "string" },
  { section: "Equipment", header: "Motor Make/Model", target: "equipment", field: "motorMakeModel", type: "string" },
  { section: "Equipment", header: "Motor Serial", target: "equipment", field: "motorSerial", type: "string" },
  { section: "Equipment", header: "Motor KW", target: "equipment", field: "motorKw", type: "float" },
  { section: "Equipment", header: "Year Installed", target: "equipment", field: "yearInstalled", type: "int" },
  { section: "Equipment", header: "Year Commissioned", target: "equipment", field: "yearCommissioned", type: "int" },
  { section: "Equipment", header: "Running Hours", target: "equipment", field: "runningHours", type: "float" },
  { section: "Equipment", header: "Last Service Date", target: "equipment", field: "lastServiceDate", type: "date" },
  { section: "Equipment", header: "Comments", target: "equipment", field: "comments", type: "string" },
  { section: "Equipment", header: "Area Classification", target: "equipment", field: "areaClassification", type: "string" },
  { section: "Equipment", header: "Equipment Sales Person", target: "equipment", field: "equipmentSalesPerson", type: "string" },
  { section: "Detailed Information", header: "Controller Type", target: "equipment", field: "controllerType", type: "string" },
  { section: "Detailed Information", header: "Oil Type", target: "equipment", field: "oilType", type: "string" },
  { section: "Detailed Information", header: "Oil Charge", target: "equipment", field: "oilCharge", type: "string" },
  { section: "Detailed Information", header: "Ref Type", target: "equipment", field: "refType", type: "string" },
  { section: "Detailed Information", header: "Ref Charge", target: "equipment", field: "refCharge", type: "string" },
  { section: "Detailed Information", header: "Comments", target: "equipment", field: "detailedComments", type: "string" },
  { section: "3rd Party Equipment", header: "Compressor Model", target: "equipment", field: "thirdPartyCompressorModel", type: "string" },
  { section: "3rd Party Equipment", header: "Run Hours", target: "equipment", field: "thirdPartyRunHours", type: "float" },
  { section: "3rd Party Equipment", header: "PSA Contract", target: "equipment", field: "thirdPartyPsaContract", type: "string" },
  { section: "3rd Party Equipment", header: "Condenser make/model", target: "equipment", field: "condenserMakeModel", type: "string" },
  { section: "3rd Party Equipment", header: "Ammonia Pump make/model", target: "equipment", field: "ammoniaPumpMakeModel", type: "string" },
];

function emptyCustomer(): CustomerInput {
  return {
    name: "",
    bpNumber: null,
    uniqueIdentifier: null,
    address: null,
    region: null,
    territory: null,
    mainContact: null,
    contactNumber: null,
    email: null,
    location: null,
    fnbOrYps: null,
    psaStatus: null,
    psaContract: null,
    psaEndDate: null,
    salesRep: null,
    opsTeam: null,
  };
}

function parseStringValue(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    // Hyperlinked cells (e.g. mailto: links in the Email column) come through as
    // { text, hyperlink }, not a plain string — String(value) on this would
    // stringify to the literal text "[object Object]".
    if ("text" in value && typeof value.text === "string") {
      const trimmed = value.text.trim();
      return trimmed === "" ? null : trimmed;
    }
    if ("richText" in value) {
      const text = (value.richText as { text: string }[]).map((r) => r.text).join("");
      const trimmed = text.trim();
      return trimmed === "" ? null : trimmed;
    }
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

function parseIntValue(value: ExcelJS.CellValue): number | null {
  const s = parseStringValue(value);
  if (s === null) return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatValue(value: ExcelJS.CellValue): number | null {
  const s = parseStringValue(value);
  if (s === null) return null;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseDateValue(value: ExcelJS.CellValue): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const s = parseStringValue(value);
  if (s === null) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCell(value: ExcelJS.CellValue, type: FieldType): string | number | Date | null {
  switch (type) {
    case "string":
      return parseStringValue(value);
    case "int":
      return parseIntValue(value);
    case "float":
      return parseFloatValue(value);
    case "date":
      return parseDateValue(value);
  }
}

function formatCell(value: string | number | Date | null): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  return value;
}

function validateHeaders(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(HEADER_LABEL_ROW);
  const mismatches: string[] = [];
  COLUMNS.forEach((col, i) => {
    const colNumber = i + 1;
    const actual = parseStringValue(row.getCell(colNumber).value) ?? "";
    if (actual !== col.header) {
      mismatches.push(`column ${colNumber}: expected "${col.header}", found "${actual}"`);
    }
  });
  if (mismatches.length > 0) {
    throw new Error(
      `Install base workbook header row ${HEADER_LABEL_ROW} doesn't match the expected layout:\n` +
        mismatches.join("\n")
    );
  }
}

function isRowEmpty(row: ExcelJS.Row): boolean {
  for (let i = 1; i <= COLUMNS.length; i++) {
    if (parseStringValue(row.getCell(i).value) !== null) return false;
  }
  return true;
}

function mergeMissingCustomerFields(target: CustomerInput, source: Partial<CustomerInput>): void {
  for (const key of Object.keys(source) as (keyof CustomerInput)[]) {
    if (key === "name") continue;
    const value = source[key];
    if (value !== null && value !== undefined && target[key] === null) {
      (target[key] as unknown) = value;
    }
  }
}

/**
 * Parses the install base workbook into customer groups. Rows are grouped by
 * contiguous blocks of the same customer name — the source sheet blanks out
 * most customer-level fields (and sometimes even the name itself) on every
 * row after the first in a group, so blank fields inherit from whichever row
 * in the group first supplied them.
 */
export async function parseInstallBaseWorkbook(
  buffer: ExcelJS.Buffer | Buffer
): Promise<CustomerGroup[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook has no worksheets");

  validateHeaders(sheet);

  const groups: CustomerGroup[] = [];
  let currentGroup: CustomerGroup | null = null;
  let lastCustomerName: string | null = null;

  for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (isRowEmpty(row)) continue;

    const customerFields: Partial<CustomerInput> = {};
    const equipment = {} as EquipmentInput;

    COLUMNS.forEach((col, i) => {
      if (col.target === "customerNo") return;
      const raw = parseCell(row.getCell(i + 1).value, col.type);
      if (col.target === "customer") {
        (customerFields as Record<string, unknown>)[col.field] = raw;
      } else {
        (equipment as unknown as Record<string, unknown>)[col.field] = raw;
      }
    });

    const nameOnRow = (customerFields.name as string | null) ?? null;

    if (!currentGroup || (nameOnRow && nameOnRow !== lastCustomerName)) {
      currentGroup = {
        customer: { ...emptyCustomer(), ...customerFields, name: nameOnRow ?? "" },
        equipment: [],
      };
      groups.push(currentGroup);
    } else {
      mergeMissingCustomerFields(currentGroup.customer, customerFields);
    }

    if (nameOnRow) lastCustomerName = nameOnRow;
    currentGroup.equipment.push(equipment);
  }

  return groups;
}

/**
 * Serializes customer groups back into a workbook matching the source
 * sheet's column layout. Every row is fully populated with its customer's
 * data (rather than reproducing the source's blank-after-first-row
 * convention) — simpler and more robust for a regenerated export.
 */
export async function serializeInstallBaseWorkbook(
  groups: CustomerGroupExport[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const sectionRow = sheet.getRow(HEADER_SECTION_ROW);
  const labelRow = sheet.getRow(HEADER_LABEL_ROW);
  let lastSection: string | null = null;
  COLUMNS.forEach((col, i) => {
    const colNumber = i + 1;
    if (col.section !== lastSection) {
      sectionRow.getCell(colNumber).value = col.section;
      lastSection = col.section;
    }
    labelRow.getCell(colNumber).value = col.header;
  });
  sectionRow.commit();
  labelRow.commit();

  let excelRowIndex = DATA_START_ROW;
  for (const group of groups) {
    for (const equipment of group.equipment) {
      const row = sheet.getRow(excelRowIndex);
      COLUMNS.forEach((col, i) => {
        const colNumber = i + 1;
        if (col.target === "customerNo") {
          row.getCell(colNumber).value = group.customer.no;
        } else if (col.target === "customer") {
          const value = (group.customer as unknown as Record<string, string | number | Date | null>)[
            col.field
          ];
          row.getCell(colNumber).value = formatCell(value);
        } else {
          const value = (equipment as unknown as Record<string, string | number | Date | null>)[
            col.field
          ];
          row.getCell(colNumber).value = formatCell(value);
        }
      });
      row.commit();
      excelRowIndex++;
    }
  }

  return workbook.xlsx.writeBuffer();
}
