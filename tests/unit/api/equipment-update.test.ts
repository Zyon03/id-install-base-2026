import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const equipmentUpdateMock = vi.fn();
const customerUpdateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipmentRecord: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => equipmentUpdateMock(...args),
    },
    customer: {
      update: (...args: unknown[]) => customerUpdateMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { PATCH } from "@/app/api/equipment/[id]/route";

const now = new Date("2026-08-09T10:20:54.000Z");

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "clx1a2b3c4d5e6f7g8h9i0j1",
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
    customer: {
      id: "clx0000000000000000001",
      no: 1,
      name: "Acme Testing Co",
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
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/equipment/clx1a2b3c4d5e6f7g8h9i0j1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeContext(id = "clx1a2b3c4d5e6f7g8h9i0j1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  findUniqueMock.mockReset();
  equipmentUpdateMock.mockReset();
  customerUpdateMock.mockReset();
  transactionMock.mockReset();

  // First findUnique call = existence check, second = re-fetch after update.
  findUniqueMock.mockResolvedValue(makeRecord());
});

describe("PATCH /api/equipment/{id}", () => {
  it("updates an equipment-only field via prisma.equipmentRecord.update", async () => {
    const res = await PATCH(makeRequest({ motor_kw: 7.5 }), makeContext());
    expect(res.status).toBe(200);

    expect(equipmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx1a2b3c4d5e6f7g8h9i0j1" },
      data: { motorKw: 7.5 },
    });
    expect(customerUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("updates a customer-only field via prisma.customer.update", async () => {
    const res = await PATCH(makeRequest({ region: "Jakarta" }), makeContext());
    expect(res.status).toBe(200);

    expect(customerUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx0000000000000000001" },
      data: { region: "Jakarta" },
    });
    expect(equipmentUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("routes a mix of customer and equipment fields through a single $transaction", async () => {
    const res = await PATCH(
      makeRequest({ region: "Jakarta", motor_kw: 7.5 }),
      makeContext()
    );
    expect(res.status).toBe(200);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(customerUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx0000000000000000001" },
      data: { region: "Jakarta" },
    });
    expect(equipmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx1a2b3c4d5e6f7g8h9i0j1" },
      data: { motorKw: 7.5 },
    });
  });

  it("converts date-time fields to Date objects before writing", async () => {
    await PATCH(makeRequest({ last_service_date: "2026-01-15T00:00:00.000Z" }), makeContext());

    expect(equipmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx1a2b3c4d5e6f7g8h9i0j1" },
      data: { lastServiceDate: new Date("2026-01-15T00:00:00.000Z") },
    });
  });

  it("allows nullable, non-required fields to be blanked to null", async () => {
    const res = await PATCH(makeRequest({ territory: null }), makeContext());
    expect(res.status).toBe(200);

    expect(customerUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx0000000000000000001" },
      data: { territory: null },
    });
  });

  it.each([
    ["customer_name", null],
    ["address", null],
    ["region", ""],
    ["main_contact", null],
    ["equip_tag", ""],
    ["model", null],
    ["compressor_type", null],
    ["serial_number", ""],
    ["brand", null],
    ["motor_make_model", null],
    ["motor_serial", ""],
    ["motor_kw", null],
    ["controller_type", null],
    ["oil_type", ""],
    ["ref_type", null],
  ])("rejects blanking the required field %s (value: %j)", async (field, value) => {
    const res = await PATCH(makeRequest({ [field]: value }), makeContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(equipmentUpdateMock).not.toHaveBeenCalled();
    expect(customerUpdateMock).not.toHaveBeenCalled();
  });

  it("does NOT reject when a required field is simply omitted from the body, even editing an unrelated field on a sparse row", async () => {
    // Row has blank required fields (equip_tag, motor_kw, etc. are null in makeRecord()),
    // but the request only touches `comments` — omitted required fields must not block it.
    const res = await PATCH(makeRequest({ comments: "Inspected fine" }), makeContext());
    expect(res.status).toBe(200);

    expect(equipmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "clx1a2b3c4d5e6f7g8h9i0j1" },
      data: { comments: "Inspected fine" },
    });
  });

  it("rejects an unknown field with a 400", async () => {
    const res = await PATCH(makeRequest({ not_a_real_field: "oops" }), makeContext());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid type for a numeric field", async () => {
    const res = await PATCH(makeRequest({ motor_kw: "not-a-number" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 404 for a nonexistent id", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const res = await PATCH(makeRequest({ region: "Jakarta" }), makeContext("does-not-exist"));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(customerUpdateMock).not.toHaveBeenCalled();
  });

  it("returns the updated row in the exact EquipmentListItem shape", async () => {
    findUniqueMock
      .mockResolvedValueOnce(makeRecord()) // existence check
      .mockResolvedValueOnce(makeRecord({ motorKw: 7.5 })); // re-fetch after update

    const res = await PATCH(makeRequest({ motor_kw: 7.5 }), makeContext());
    const body = await res.json();

    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data).toEqual({
      id: "clx1a2b3c4d5e6f7g8h9i0j1",
      customer_id: "clx0000000000000000001",
      customer_no: 1,
      customer_name: "Acme Testing Co",
      address: "1 Fake Street",
      region: "Testville",
      territory: "Testville",
      main_contact: "Ms. Example",
      contact_number: null,
      email: null,
      location: null,
      fnb_or_yps: "F&B",
      psa_status: "No PSA",
      psa_contract: null,
      psa_end_date: null,
      sales_rep: null,
      ops_team: null,
      equip_tag: null,
      model: "Model A",
      compressor_type: null,
      serial_number: "SN-001",
      brand: "Frick",
      motor_make_model: null,
      motor_serial: null,
      motor_kw: 7.5,
      year_installed: null,
      year_commissioned: null,
      running_hours: null,
      last_service_date: null,
      comments: null,
      area_classification: null,
      equipment_sales_person: null,
      controller_type: "Quantum LX",
      oil_type: null,
      oil_charge: null,
      ref_type: null,
      ref_charge: null,
      detailed_comments: null,
      third_party_compressor_model: null,
      third_party_run_hours: null,
      third_party_psa_contract: null,
      condenser_make_model: null,
      ammonia_pump_make_model: null,
      created_at: "2026-08-09T10:20:54.000Z",
      updated_at: "2026-08-09T10:20:54.000Z",
    });
  });

  it("returns 400 for a malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/equipment/clx1a2b3c4d5e6f7g8h9i0j1", {
      method: "PATCH",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await PATCH(makeRequest({ region: "Jakarta" }), makeContext());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
