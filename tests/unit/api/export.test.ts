import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const serializeMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

vi.mock("@/lib/xlsx", () => ({
  serializeInstallBaseWorkbook: (...args: unknown[]) => serializeMock(...args),
}));

// Imported after the mocks so the route picks up the mocked modules.
import { GET } from "@/app/api/export/route";

const now = new Date("2026-08-09T10:20:54.000Z");

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "clx0000000000000000001",
    no: 1,
    name: "Acme Testing Co",
    bpNumber: null,
    uniqueIdentifier: null,
    address: "1 Fake Street",
    region: "Testville",
    territory: "Testville",
    mainContact: "Ms. Example",
    contactNumber: null,
    email: null,
    location: null,
    fnbOrYps: "F&B",
    psaStatus: "No PSA",
    psaContract: null,
    psaEndDate: null,
    salesRep: null,
    opsTeam: null,
    createdAt: now,
    updatedAt: now,
    equipment: [
      {
        id: "clxequip000000000000001",
        customerId: "clx0000000000000000001",
        equipTag: null,
        model: "Model A",
        compressorType: null,
        serialNumber: "SN-001",
        brand: "Frick",
        motorMakeModel: null,
        motorSerial: null,
        motorKw: null,
        yearInstalled: null,
        yearCommissioned: null,
        runningHours: null,
        lastServiceDate: null,
        comments: null,
        areaClassification: null,
        equipmentSalesPerson: null,
        controllerType: "Quantum LX",
        oilType: null,
        oilCharge: null,
        refType: null,
        refCharge: null,
        detailedComments: null,
        thirdPartyCompressorModel: null,
        thirdPartyRunHours: null,
        thirdPartyPsaContract: null,
        condenserMakeModel: null,
        ammoniaPumpMakeModel: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  serializeMock.mockReset();
  findManyMock.mockResolvedValue([makeCustomer()]);
  serializeMock.mockResolvedValue(Buffer.from("fake-xlsx-bytes"));
});

describe("GET /api/export", () => {
  it("queries every customer with its equipment, ordered by customer no", async () => {
    await GET();

    expect(findManyMock).toHaveBeenCalledWith({
      include: { equipment: true },
      orderBy: { no: "asc" },
    });
  });

  it("maps customer + equipment fields into the shape serializeInstallBaseWorkbook expects", async () => {
    await GET();

    expect(serializeMock).toHaveBeenCalledWith([
      {
        customer: {
          no: 1,
          name: "Acme Testing Co",
          bpNumber: null,
          uniqueIdentifier: null,
          address: "1 Fake Street",
          region: "Testville",
          territory: "Testville",
          mainContact: "Ms. Example",
          contactNumber: null,
          email: null,
          location: null,
          fnbOrYps: "F&B",
          psaStatus: "No PSA",
          psaContract: null,
          psaEndDate: null,
          salesRep: null,
          opsTeam: null,
        },
        equipment: [
          {
            equipTag: null,
            model: "Model A",
            compressorType: null,
            serialNumber: "SN-001",
            brand: "Frick",
            motorMakeModel: null,
            motorSerial: null,
            motorKw: null,
            yearInstalled: null,
            yearCommissioned: null,
            runningHours: null,
            lastServiceDate: null,
            comments: null,
            areaClassification: null,
            equipmentSalesPerson: null,
            controllerType: "Quantum LX",
            oilType: null,
            oilCharge: null,
            refType: null,
            refCharge: null,
            detailedComments: null,
            thirdPartyCompressorModel: null,
            thirdPartyRunHours: null,
            thirdPartyPsaContract: null,
            condenserMakeModel: null,
            ammoniaPumpMakeModel: null,
          },
        ],
      },
    ]);
  });

  it("returns the workbook buffer with the correct content type and a dated filename", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="id-install-base-export-\d{4}-\d{2}-\d{2}\.xlsx"$/);

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString()).toBe("fake-xlsx-bytes");
  });

  it("handles a customer with zero equipment records without crashing", async () => {
    findManyMock.mockResolvedValue([makeCustomer({ equipment: [] })]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(serializeMock.mock.calls[0][0][0].equipment).toEqual([]);
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    findManyMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await GET();
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });

  it("returns 500 with an internal_error envelope when serialization throws", async () => {
    serializeMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET();
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
  });
});
