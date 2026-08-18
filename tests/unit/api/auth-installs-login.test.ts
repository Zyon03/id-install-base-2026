import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appConfig: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

// Imported after the mock so the route picks up the mocked prisma client.
import { POST } from "@/app/api/auth/installs-login/route";
import { verifyInstallsSessionToken, INSTALLS_SESSION_COOKIE } from "@/lib/auth";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/installs-login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  findFirstMock.mockReset();
  process.env.AUTH_COOKIE_SECRET = "test-secret";
});

describe("POST /api/auth/installs-login", () => {
  it("sets a valid session cookie when the password matches", async () => {
    findFirstMock.mockResolvedValue({ id: "cfg1", installsPassword: "correct horse" });

    const res = await POST(makeRequest({ password: "correct horse" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ data: { authenticated: true } });

    const cookie = res.cookies.get(INSTALLS_SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(verifyInstallsSessionToken(cookie?.value)).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("rejects a wrong password with 401 and no cookie", async () => {
    findFirstMock.mockResolvedValue({ id: "cfg1", installsPassword: "correct horse" });

    const res = await POST(makeRequest({ password: "wrong guess" }));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("invalid_password");
    expect(res.cookies.get(INSTALLS_SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects with 401 (not a leaky error) when no AppConfig row exists yet", async () => {
    findFirstMock.mockResolvedValue(null);

    const res = await POST(makeRequest({ password: "anything" }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(INSTALLS_SESSION_COOKIE)).toBeUndefined();
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 400 when password is not a string", async () => {
    const res = await POST(makeRequest({ password: 12345 }));
    expect(res.status).toBe(400);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown field", async () => {
    const res = await POST(makeRequest({ password: "x", extra: "nope" }));
    expect(res.status).toBe(400);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 500 with an internal_error envelope when Prisma throws", async () => {
    findFirstMock.mockRejectedValueOnce(new Error("connection refused: secret-host:5432"));

    const res = await POST(makeRequest({ password: "anything" }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret-host");
  });
});
