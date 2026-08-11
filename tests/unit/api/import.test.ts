// @vitest-environment node
//
// jsdom's fetch/Request implementation hangs indefinitely parsing a
// multipart body that contains a Blob part (request.formData() never
// resolves) — every other route test file uses jsdom fine since none of
// them deal with file uploads. Node's native undici-based fetch handles it
// correctly, so this file alone opts out of the project-wide jsdom default.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeRawUnsafeMock = vi.fn();
const customerCreateMock = vi.fn();
const parseInstallBaseWorkbookMock = vi.fn();

interface FakeTransactionClient {
  $executeRawUnsafe: (...args: unknown[]) => unknown;
  customer: { create: (...args: unknown[]) => unknown };
}

const tx: FakeTransactionClient = {
  $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafeMock(...args),
  customer: {
    create: (...args: unknown[]) => customerCreateMock(...args),
  },
};

const transactionMock = vi.fn(
  async (callback: (tx: FakeTransactionClient) => Promise<void>) => callback(tx),
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: [(tx: FakeTransactionClient) => Promise<void>]) => transactionMock(...args),
  },
}));

vi.mock("@/lib/xlsx", () => ({
  parseInstallBaseWorkbook: (...args: unknown[]) => parseInstallBaseWorkbookMock(...args),
}));

// Imported after the mocks so the route picks up the mocked modules.
import { POST } from "@/app/api/import/route";

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    customer: { name: "Acme Testing Co", no: 1 },
    equipment: [{ model: "Model A" }, { model: "Model B" }],
    ...overrides,
  };
}

function makeRequest(fields: { file?: Blob | null; confirm?: string | null } = {}): NextRequest {
  const formData = new FormData();
  if (fields.file !== null) {
    formData.set(
      "file",
      fields.file ?? new Blob([Buffer.from("fake-xlsx-bytes")]),
      "install-base.xlsx",
    );
  }
  if (fields.confirm !== null) {
    formData.set("confirm", fields.confirm ?? "true");
  }
  return new NextRequest("http://localhost/api/import", { method: "POST", body: formData });
}

beforeEach(() => {
  executeRawUnsafeMock.mockReset();
  customerCreateMock.mockReset();
  parseInstallBaseWorkbookMock.mockReset();
  transactionMock.mockClear();
  parseInstallBaseWorkbookMock.mockResolvedValue([makeGroup()]);
  customerCreateMock.mockResolvedValue({ id: "clx0000000000000000001" });
});

describe("POST /api/import", () => {
  it("returns 400 when the file field is missing", async () => {
    const res = await POST(makeRequest({ file: null }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toEqual({ file: "This field is required" });
    expect(parseInstallBaseWorkbookMock).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm is not the literal string \"true\"", async () => {
    const res = await POST(makeRequest({ confirm: "false" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toEqual({ confirm: "Must be true to proceed." });
    expect(parseInstallBaseWorkbookMock).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm is missing entirely", async () => {
    const res = await POST(makeRequest({ confirm: null }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.details).toEqual({ confirm: "Must be true to proceed." });
  });

  it("returns 400 with a validation_error envelope when parsing the workbook throws", async () => {
    parseInstallBaseWorkbookMock.mockRejectedValueOnce(new Error("Workbook has no worksheets"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("truncates then recreates every customer with nested equipment inside a single transaction", async () => {
    const groups = [makeGroup({ customer: { name: "Acme", no: 1 } }), makeGroup({ customer: { name: "Beta", no: 2 } })];
    parseInstallBaseWorkbookMock.mockResolvedValue(groups);

    await POST(makeRequest());

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafeMock).toHaveBeenCalledWith(
      'TRUNCATE TABLE "EquipmentRecord", "Customer" RESTART IDENTITY CASCADE',
    );
    expect(customerCreateMock).toHaveBeenCalledTimes(2);
    expect(customerCreateMock).toHaveBeenNthCalledWith(1, {
      data: {
        name: "Acme",
        no: 1,
        equipment: { create: groups[0].equipment },
      },
    });
  });

  it("returns customers_imported/equipment_imported counts matching the parsed groups", async () => {
    parseInstallBaseWorkbookMock.mockResolvedValue([
      makeGroup({ equipment: [{ model: "A" }, { model: "B" }, { model: "C" }] }),
      makeGroup({ equipment: [{ model: "D" }] }),
    ]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data).toEqual({ customers_imported: 2, equipment_imported: 4 });
  });

  it("returns 500 with an internal_error envelope when the transaction fails, without leaking details", async () => {
    transactionMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
