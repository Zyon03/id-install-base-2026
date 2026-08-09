import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { POST } from "@/app/api/customers/route";

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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_BODY = {
  name: "Acme Testing Co",
  address: "1 Fake Street",
  region: "Testville",
  main_contact: "Ms. Example",
};

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue(makeCustomer());
});

describe("POST /api/customers", () => {
  it("creates a customer with just the required fields", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);

    expect(createMock).toHaveBeenCalledWith({
      data: {
        name: "Acme Testing Co",
        address: "1 Fake Street",
        region: "Testville",
        mainContact: "Ms. Example",
      },
    });
  });

  it("returns the full CustomerItem shape, snake_case", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(body).toEqual({
      data: {
        id: "clx0000000000000000001",
        no: 1,
        name: "Acme Testing Co",
        bp_number: null,
        unique_identifier: null,
        address: "1 Fake Street",
        region: "Testville",
        territory: null,
        main_contact: "Ms. Example",
        contact_number: null,
        email: null,
        location: null,
        fnb_or_yps: null,
        psa_status: null,
        psa_contract: null,
        psa_end_date: null,
        sales_rep: null,
        ops_team: null,
        created_at: "2026-08-09T10:20:54.000Z",
        updated_at: "2026-08-09T10:20:54.000Z",
      },
    });
  });

  it("passes optional fields through when provided", async () => {
    await POST(makeRequest({ ...VALID_BODY, territory: "Testville North", email: "a@b.com" }));

    const call = createMock.mock.calls[0][0];
    expect(call.data.territory).toBe("Testville North");
    expect(call.data.email).toBe("a@b.com");
  });

  it.each(["name", "address", "region", "main_contact"])(
    "returns 400 when required field %s is missing",
    async (field) => {
      const body = { ...VALID_BODY } as Record<string, unknown>;
      delete body[field];

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
      const responseBody = await res.json();
      expect(responseBody.error.code).toBe("validation_error");
      expect(createMock).not.toHaveBeenCalled();
    }
  );

  it.each(["name", "address", "region", "main_contact"])(
    "returns 400 when required field %s is blank",
    async (field) => {
      const res = await POST(makeRequest({ ...VALID_BODY, [field]: "" }));
      expect(res.status).toBe(400);
      expect(createMock).not.toHaveBeenCalled();
    }
  );

  it("returns 400 for an unknown field", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, not_a_real_field: "oops" }));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    createMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
