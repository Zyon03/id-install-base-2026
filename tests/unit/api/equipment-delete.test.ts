import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipmentRecord: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { DELETE } from "@/app/api/equipment/[id]/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/equipment/clx1a2b3c4d5e6f7g8h9i0j1", {
    method: "DELETE",
  });
}

function makeContext(id = "clx1a2b3c4d5e6f7g8h9i0j1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  findUniqueMock.mockReset();
  deleteMock.mockReset();
  findUniqueMock.mockResolvedValue({ id: "clx1a2b3c4d5e6f7g8h9i0j1" });
  deleteMock.mockResolvedValue({ id: "clx1a2b3c4d5e6f7g8h9i0j1" });
});

describe("DELETE /api/equipment/{id}", () => {
  it("deletes the record and returns { data: { id } }", async () => {
    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ data: { id: "clx1a2b3c4d5e6f7g8h9i0j1" } });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "clx1a2b3c4d5e6f7g8h9i0j1" } });
  });

  it("returns 404 without calling delete when the record doesn't exist", async () => {
    findUniqueMock.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), makeContext("does-not-exist"));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 500 with an internal_error envelope when Prisma throws, without leaking details", async () => {
    deleteMock.mockRejectedValue(new Error("connection refused: secret-host:5432"));

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
