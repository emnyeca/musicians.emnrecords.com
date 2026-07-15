import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Transitional shared-password access control for the operator-only admin.
 *
 * On success an HMAC-signed, httpOnly cookie grants access for 12 hours.
 * Passwords are verified server-side only and never reach the client bundle.
 */

export type AccessScope = "admin";

export const ACCESS_COOKIE_NAMES: Record<AccessScope, string> = {
  admin: "emn_admin_access",
};

export const ACCESS_SESSION_SECONDS = 12 * 60 * 60; // 12 hours

/**
 * Development-only fallback passwords so a fresh checkout works without env
 * vars. Never active when NODE_ENV === "production".
 */
const DEV_FALLBACK_PASSWORDS: Record<AccessScope, string> = {
  admin: "admin-dev",
};

type ScopeSecret = {
  /** sha256 hex of the expected password. */
  passwordSha256Hex: string;
  /** Key material for signing session tokens. */
  signingKey: string;
  usingDevFallback: boolean;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function getScopeSecret(scope: AccessScope): ScopeSecret | null {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD;

  let passwordSha256Hex: string | null = null;
  let usingDevFallback = false;
  if (hash && hash.trim().length > 0) {
    passwordSha256Hex = hash.trim().toLowerCase();
  } else if (plain && plain.length > 0) {
    passwordSha256Hex = sha256Hex(plain);
  } else if (process.env.NODE_ENV !== "production") {
    passwordSha256Hex = sha256Hex(DEV_FALLBACK_PASSWORDS[scope]);
    usingDevFallback = true;
  }
  if (!passwordSha256Hex) return null;

  const signingKey =
    process.env.ACCESS_TOKEN_SECRET ??
    sha256Hex(`emn-access:${scope}:${passwordSha256Hex}`);
  return { passwordSha256Hex, signingKey, usingDevFallback };
}

export function isAccessConfigured(scope: AccessScope): boolean {
  return getScopeSecret(scope) !== null;
}

export function isUsingDevFallbackPassword(scope: AccessScope): boolean {
  return getScopeSecret(scope)?.usingDevFallback ?? false;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyPassword(scope: AccessScope, input: string): boolean {
  const secret = getScopeSecret(scope);
  if (!secret) return false;
  return safeEqualHex(sha256Hex(input), secret.passwordSha256Hex);
}

function signToken(scope: AccessScope, expiresAtEpoch: number, key: string): string {
  return createHmac("sha256", key)
    .update(`${scope}:${expiresAtEpoch}`)
    .digest("hex");
}

/** Token format: "<expiresAtEpochSeconds>.<hmacHex>" */
export function createAccessToken(scope: AccessScope): string | null {
  const secret = getScopeSecret(scope);
  if (!secret) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_SESSION_SECONDS;
  return `${expiresAt}.${signToken(scope, expiresAt, secret.signingKey)}`;
}

export function verifyAccessToken(scope: AccessScope, token: string): boolean {
  const secret = getScopeSecret(scope);
  if (!secret) return false;
  const [expStr, signature] = token.split(".");
  if (!expStr || !signature) return false;
  const expiresAt = Number.parseInt(expStr, 10);
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt * 1000 < Date.now()) return false;
  return safeEqualHex(signToken(scope, expiresAt, secret.signingKey), signature);
}

/** For server components / route handlers: does the request have access? */
export async function hasValidAccess(scope: AccessScope): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAMES[scope])?.value;
  if (!token) return false;
  return verifyAccessToken(scope, token);
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_SESSION_SECONDS,
  };
}

/**
 * Minimal in-memory rate limiter for password attempts.
 * Per-instance only (resets on serverless cold start) — good enough as a
 * first line of defense in v0.1.
 */
const attemptLog = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export function isRateLimited(scope: AccessScope, clientKey: string): boolean {
  const key = `${scope}:${clientKey}`;
  const now = Date.now();
  const entry = attemptLog.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) return false;
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

export function recordFailedAttempt(scope: AccessScope, clientKey: string): void {
  const key = `${scope}:${clientKey}`;
  const now = Date.now();
  const entry = attemptLog.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attemptLog.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(scope: AccessScope, clientKey: string): void {
  attemptLog.delete(`${scope}:${clientKey}`);
}
