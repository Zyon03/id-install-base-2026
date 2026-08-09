import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { GET } from "@/app/api/customers/route";

const now = new Date("2026-08-09T10:20:54.000Z");

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "clx0000000000000000001",
    no: 1,
    name: "Acme Testing Co",
    address: "1 Fake Street",
    region: "Testville",
    mainContact: "Ms. Example",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/customers${query}`);
}

beforeEach(() => {
  findManyMock.mockReset();
  findManyMock.mockResolvedValue([makeCustomer()]);
});

describe("GET /api/customers", () => {
  it("defaults to limit=20 and no search filter", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, where: {} })
    );
  });

  it("returns the CustomerSummary shape, snake_case", async () => {
    const res = await GET(makeRequest(""));
    const body = await res.json();

    expect(body).toEqual({
      data: {
        customers: [
          {
            id: "clx0000000000000000001",
            no: 1,
            name: "Acme Testing Co",
            address: "1 Fake Street",
            region: "Testville",
            main_contact: "Ms. Example",
          },
        ],
      },
    });
  });

  it("builds a case-insensitive OR search across name and address", async () => {
    await GET(makeRequest("?search=acme"));

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { name: { contains: "acme", mode: "insensitive" } },
      { address: { contains: "acme", mode: "insensitive" } },
    ]);
  });

  it("honors an explicit limit", async () => {
    await GET(makeRequest("?limit=5"));

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("returns 400 for limit exceeding the max of 50", async () => {
    const res = await GET(makeRequest("?limit=51"));
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
