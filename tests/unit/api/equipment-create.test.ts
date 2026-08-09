import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const customerFindUniqueMock = vi.fn();
const equipmentCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: (...args: unknown[]) => customerFindUniqueMock(...args),
    },
    equipmentRecord: {
      create: (...args: unknown[]) => equipmentCreateMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { POST } from "@/app/api/equipment/route";

const now = new Date("2026-08-09T10:20:54.000Z");

function makeCreatedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "clx1a2b3c4d5e6f7g8h9i0j1",
    customerId: "clx0000000000000000001",
    equipTag: "CMP-001",
    model: "RXF 85 H",
    compressorType: "Screw",
    serialNumber: "SN-001",
    brand: "Frick",
    motorMakeModel: "ABB M3BP",
    motorSerial: "MS-001",
    motorKw: 75,
    yearInstalled: null,
    yearCommissioned: null,
    runningHours: null,
    lastServiceDate: null,
    comments: null,
    areaClassification: null,
    equipmentSalesPerson: null,
    controllerType: "Quantum LX",
    oilType: "Synthetic",
    oilCharge: null,
    refType: "R717",
    refCharge: null,
    detailedComments: null,
    thirdPartyCompressorModel: null,
    thirdPartyRunHours: null,
    thirdPartyPsaContract: null,
    condenserMakeModel: null,
    ammoniaPumpMakeModel: null,
    createdAt: now,
    updatedAt: now,
    customer: {
      id: "clx0000000000000000001",
      no: 1,
      name: "Acme Testing Co",
      address: "1 Fake Street",
      region: "Testville",
      territory: null,
      mainContact: "Ms. Example",
      contactNumber: null,
      email: null,
      location: null,
      fnbOrYps: null,
      psaStatus: null,
      psaContract: null,
      psaEndDate: null,
      salesRep: null,
      opsTeam: null,
    },
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/equipment", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_BODY = {
  customer_id: "clx0000000000000000001",
  equip_tag: "CMP-001",
  model: "RXF 85 H",
  compressor_type: "Screw",
  serial_number: "SN-001",
  brand: "Frick",
  motor_make_model: "ABB M3BP",
  motor_serial: "MS-001",
  motor_kw: 75,
  controller_type: "Quantum LX",
  oil_type: "Synthetic",
  ref_type: "R717",
};

beforeEach(() => {
  customerFindUniqueMock.mockReset();
  equipmentCreateMock.mockReset();
  customerFindUniqueMock.mockResolvedValue({ id: "clx0000000000000000001" });
  equipmentCreateMock.mockResolvedValue(makeCreatedRecord());
});

describe("POST /api/equipment", () => {
  it("creates an equipment record with just the required fields", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);

    expect(equipmentCreateMock).toHaveBeenCalledWith({
      data: {
        customerId: "clx0000000000000000001",
        equipTag: "CMP-001",
        model: "RXF 85 H",
        compressorType: "Screw",
        serialNumber: "SN-001",
        brand: "Frick",
        motorMakeModel: "ABB M3BP",
        motorSerial: "MS-001",
        motorKw: 75,
        controllerType: "Quantum LX",
        oilType: "Synthetic",
        refType: "R717",
      },
      include: { customer: true },
    });
  });

  it("returns the EquipmentListItem shape, matching GET's item shape", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(body.data).toMatchObject({
      id: "clx1a2b3c4d5e6f7g8h9i0j1",
      customer_id: "clx0000000000000000001",
      customer_name: "Acme Testing Co",
      equip_tag: "CMP-001",
      model: "RXF 85 H",
      motor_kw: 75,
    });
  });

  it("passes optional fields through when provided", async () => {
    await POST(makeRequest({ ...VALID_BODY, year_installed: 2020, comments: "New install" }));

    const call = equipmentCreateMock.mock.calls[0][0];
    expect(call.data.yearInstalled).toBe(2020);
    expect(call.data.comments).toBe("New install");
  });

  it("returns 404 when customer_id does not reference an existing customer", async () => {
    customerFindUniqueMock.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(equipmentCreateMock).not.toHaveBeenCalled();
  });

  it.each([
    "equip_tag",
    "model",
    "compressor_type",
    "serial_number",
    "brand",
    "motor_make_model",
    "motor_serial",
    "motor_kw",
    "controller_type",
    "oil_type",
    "ref_type",
  ])("returns 400 when required field %s is missing", async (field) => {
    const body = { ...VALID_BODY } as Record<string, unknown>;
    delete body[field];

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const responseBody = await res.json();
    expect(responseBody.error.code).toBe("validation_error");
    expect(equipmentCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when customer_id is missing", async () => {
    const body = { ...VALID_BODY } as Record<string, unknown>;
    delete body.customer_id;

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(customerFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown field", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, not_a_real_field: "oops" }));
    expect(res.status).toBe(400);
    expect(equipmentCreateMock).not.toHaveBeenCalled();
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    equipmentCreateMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
