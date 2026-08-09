import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipmentRecord: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { GET } from "@/app/api/equipment/route";

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

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/equipment${query}`);
}

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
  findManyMock.mockResolvedValue([makeRecord()]);
  countMock.mockResolvedValue(1);
});

describe("GET /api/equipment", () => {
  it("applies default pagination (page=1, page_size=50) when no query params are given", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 })
    );

    const body = await res.json();
    expect(body.data.pagination).toEqual({
      page: 1,
      page_size: 50,
      total_items: 1,
      total_pages: 1,
    });
  });

  it("returns the response envelope with exact snake_case field names", async () => {
    const res = await GET(makeRequest(""));
    const body = await res.json();

    expect(Object.keys(body)).toEqual(["data"]);
    expect(Object.keys(body.data).sort()).toEqual(["equipment", "pagination"]);

    expect(body.data.equipment).toEqual([
      {
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
        motor_kw: null,
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
      },
    ]);
  });

  it("honors explicit page and page_size", async () => {
    await GET(makeRequest("?page=3&page_size=10"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("computes total_pages via Math.ceil(total_items / page_size)", async () => {
    countMock.mockResolvedValue(101);
    const res = await GET(makeRequest("?page_size=50"));
    const body = await res.json();

    expect(body.data.pagination).toEqual({
      page: 1,
      page_size: 50,
      total_items: 101,
      total_pages: 3,
    });
  });

  it("builds a case-insensitive OR search across customer name, address, equip_tag, model, serial_number", async () => {
    await GET(makeRequest("?search=frick"));

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { customer: { name: { contains: "frick", mode: "insensitive" } } },
      { customer: { address: { contains: "frick", mode: "insensitive" } } },
      { equipTag: { contains: "frick", mode: "insensitive" } },
      { model: { contains: "frick", mode: "insensitive" } },
      { serialNumber: { contains: "frick", mode: "insensitive" } },
    ]);
  });

  it.each([
    ["region", "region", "Testville"],
    ["territory", "territory", "Testville"],
    ["fnb_or_yps", "fnbOrYps", "F&B"],
    ["psa_status", "psaStatus", "No PSA"],
  ])("filters exactly on customer.%s via query param %s", async (_label, prismaField, value) => {
    await GET(makeRequest(`?${_label}=${encodeURIComponent(value)}`));

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.customer).toEqual({ [prismaField]: value });
  });

  it.each([
    ["brand", "brand", "Frick"],
    ["compressor_type", "compressorType", "Screw"],
    ["controller_type", "controllerType", "Quantum LX"],
    ["oil_type", "oilType", "Synthetic"],
    ["ref_type", "refType", "R717"],
  ])("filters exactly on equipment.%s via query param %s", async (queryParam, prismaField, value) => {
    await GET(makeRequest(`?${queryParam}=${encodeURIComponent(value)}`));

    const call = findManyMock.mock.calls[0][0];
    expect(call.where[prismaField]).toBe(value);
  });

  it("returns 400 with a validation_error envelope for a non-numeric page", async () => {
    const res = await GET(makeRequest("?page=abc"));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(typeof body.error.message).toBe("string");
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 400 for page=0 (below minimum)", async () => {
    const res = await GET(makeRequest("?page=0"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 400 for page_size exceeding the max of 200", async () => {
    const res = await GET(makeRequest("?page_size=201"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    findManyMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await GET(makeRequest(""));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
