import { createHmac, timingSafeEqual } from "node:crypto";

export const INSTALLS_SESSION_COOKIE = "installs_session";
export const INSTALLS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) {
    throw new Error("AUTH_COOKIE_SECRET is not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// Token is `<expiresAtMs>.<hmac-sha256 of expiresAtMs>` — carries no
// information about the password itself, so it can't be used to recover it.
export function createInstallsSessionToken(now: Date = new Date()): string {
  const expiresAt = now.getTime() + INSTALLS_SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifyInstallsSessionToken(
  token: string | undefined | null,
  now: Date = new Date()
): boolean {
  if (!token) return false;

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) return false;

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;

  return now.getTime() < expiresAt;
}
