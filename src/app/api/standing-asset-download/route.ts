import { type NextRequest, NextResponse } from "next/server";
import { hasValidAccess } from "@/lib/assets/access";
import { getStandingAssetById } from "@/lib/assets/standing-assets";

export const runtime = "nodejs";

/**
 * Download entry point. Large files are NOT proxied through Vercel — after
 * the access check this redirects to the WordPress/ConoHa file URL, so the
 * file itself is served by ConoHa.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing asset id." },
      { status: 400 },
    );
  }

  const asset = await getStandingAssetById(id);
  if (!asset || !asset.isActive) {
    return NextResponse.json(
      { ok: false, error: "Asset not found." },
      { status: 404 },
    );
  }

  if (asset.visibility === "members_only") {
    const authorized = await hasValidAccess("member-download");
    if (!authorized) {
      // Send unauthenticated visitors to the password gate.
      return NextResponse.redirect(
        new URL("/member/standing-assets", request.nextUrl.origin),
        302,
      );
    }
  }

  return NextResponse.redirect(asset.fileUrl, 302);
}
