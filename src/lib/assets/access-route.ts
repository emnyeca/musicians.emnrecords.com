import { type NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAMES,
  accessCookieOptions,
  type AccessScope,
  clearAttempts,
  createAccessToken,
  isAccessConfigured,
  isRateLimited,
  recordFailedAttempt,
  verifyPassword,
} from "./access";

/**
 * Shared POST (login) / DELETE (logout) handlers for the two password gates.
 * Passwords are verified server-side; success sets an httpOnly cookie.
 */
export function makeAccessRouteHandlers(scope: AccessScope) {
  async function POST(request: NextRequest) {
    const clientKey =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    if (isRateLimited(scope, clientKey)) {
      return NextResponse.json(
        { ok: false, error: "試行回数が多すぎます。しばらく待ってください。" },
        { status: 429 },
      );
    }
    if (!isAccessConfigured(scope)) {
      return NextResponse.json(
        { ok: false, error: "パスワードがサーバーに設定されていません。" },
        { status: 503 },
      );
    }

    let password = "";
    try {
      const body = (await request.json()) as { password?: unknown };
      if (typeof body.password === "string") password = body.password;
    } catch {
      // fall through to empty password → rejected
    }

    if (password === "" || !verifyPassword(scope, password)) {
      recordFailedAttempt(scope, clientKey);
      return NextResponse.json(
        { ok: false, error: "パスワードが違います。" },
        { status: 401 },
      );
    }

    clearAttempts(scope, clientKey);
    const token = createAccessToken(scope);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "アクセストークンを発行できませんでした。" },
        { status: 503 },
      );
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE_NAMES[scope], token, accessCookieOptions());
    return response;
  }

  async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE_NAMES[scope], "", {
      ...accessCookieOptions(),
      maxAge: 0,
    });
    return response;
  }

  return { POST, DELETE };
}
