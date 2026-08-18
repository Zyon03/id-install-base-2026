import { beforeEach, describe, expect, it } from "vitest";
import {
  createInstallsSessionToken,
  verifyInstallsSessionToken,
} from "@/lib/auth";

beforeEach(() => {
  process.env.AUTH_COOKIE_SECRET = "test-secret";
});

describe("createInstallsSessionToken / verifyInstallsSessionToken", () => {
  it("verifies a freshly created token as valid", () => {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const token = createInstallsSessionToken(now);

    expect(verifyInstallsSessionToken(token, now)).toBe(true);
  });

  it("stays valid just before the 30-day expiry", () => {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const token = createInstallsSessionToken(now);
    const justBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 - 1000);

    expect(verifyInstallsSessionToken(token, justBefore)).toBe(true);
  });

  it("rejects a token past its 30-day expiry", () => {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const token = createInstallsSessionToken(now);
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 1000);

    expect(verifyInstallsSessionToken(token, later)).toBe(false);
  });

  it("rejects a token with a tampered signature", () => {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const token = createInstallsSessionToken(now);
    const [payload] = token.split(".");
    const tampered = `${payload}.0000000000000000000000000000000000000000000000000000000000000000`;

    expect(verifyInstallsSessionToken(tampered, now)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const token = createInstallsSessionToken(now);

    process.env.AUTH_COOKIE_SECRET = "a-different-secret";
    expect(verifyInstallsSessionToken(token, now)).toBe(false);
  });

  it.each([undefined, null, "", "not-a-real-token", "missingdot"])(
    "rejects malformed input %p",
    (input) => {
      expect(verifyInstallsSessionToken(input, new Date())).toBe(false);
    }
  );
});
