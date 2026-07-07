import { type NextRequest, NextResponse } from "next/server";
import { hasValidAccess } from "@/lib/assets/access";
import {
  countActiveAssetsForMusician,
  createStandingAsset,
} from "@/lib/assets/standing-assets";
import {
  MAX_ASSETS_PER_MUSICIAN,
  validateUploadFile,
} from "@/lib/assets/validation";
import { makeStoredFilename } from "@/lib/utils/file";
import { slugifyWithFallback } from "@/lib/utils/slugify";

export const runtime = "nodejs";

/**
 * LEGACY — LOCAL DEVELOPMENT FALLBACK ONLY.
 *
 * The production upload path is the WordPress custom endpoint on ConoHa
 * (NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT, implemented in
 * wordpress-plugin/emn-musicians-assets). Vercel serverless request bodies
 * are limited to ~4.5MB, so this route must never be the main path for
 * 20MB standing assets.
 *
 * In production this route always answers 410 Gone. In development it
 * simulates the WordPress upload (no file is stored anywhere) so the form
 * can be exercised without a WordPress instance. Field names mirror the
 * WordPress endpoint (snake_case).
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This route is retired. Uploads go directly to the WordPress endpoint (NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT).",
      },
      { status: 410 },
    );
  }

  if (!(await hasValidAccess("asset-upload"))) {
    return NextResponse.json(
      { ok: false, error: "アップロード用パスワードでの認証が必要です。" },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "ファイルが指定されていません。" },
      { status: 400 },
    );
  }

  const musicianId = text(form, "musician_id");
  const musicianSlug = text(form, "musician_slug");
  const title = text(form, "title");
  const consent = text(form, "consent") === "true";

  if (!musicianId || title === "") {
    return NextResponse.json(
      { ok: false, error: "ミュージシャンとタイトルは必須です。" },
      { status: 400 },
    );
  }
  if (!consent) {
    return NextResponse.json(
      { ok: false, error: "権利・許可に関する同意が必要です。" },
      { status: 400 },
    );
  }

  const validation = validateUploadFile({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.reason },
      { status: 400 },
    );
  }

  const existingCount = await countActiveAssetsForMusician(musicianId);
  if (existingCount !== null && existingCount >= MAX_ASSETS_PER_MUSICIAN) {
    return NextResponse.json(
      {
        ok: false,
        error: `1人あたりの素材登録は最大${MAX_ASSETS_PER_MUSICIAN}件です。`,
      },
      { status: 400 },
    );
  }

  const visibility =
    text(form, "visibility") === "public"
      ? ("public" as const)
      : ("members_only" as const);
  const storedFilename = makeStoredFilename(
    slugifyWithFallback(musicianSlug, "asset"),
    validation.extension,
  );

  // Simulated URL — no file is actually stored by this dev fallback.
  const fileUrl = `https://wordpress.example.invalid/wp-content/uploads/${storedFilename}`;

  const warnings: string[] = [
    "開発用シミュレーション: 実ファイルはどこにも保存されていません。",
  ];
  let assetId: string | null = null;
  try {
    const created = await createStandingAsset({
      musicianId,
      title,
      description: nullable(text(form, "description")),
      fileUrl,
      storageBackend: "wordpress_media",
      wpMediaId: null,
      originalFilename: file.name,
      storedFilename,
      mimeType: file.type,
      fileSizeBytes: file.size,
      visibility,
      accessNote: nullable(text(form, "access_note")),
      allowCreditUse: text(form, "allow_credit_use") === "true",
      allowThumbnailUse: text(form, "allow_thumbnail_use") === "true",
      allowCropping: text(form, "allow_cropping") === "true",
      allowColorAdjustment: text(form, "allow_color_adjustment") === "true",
      requireCredit: text(form, "require_credit") === "true",
      creditText: nullable(text(form, "credit_text")),
      usageTerms: nullable(text(form, "usage_terms")),
    });
    if (created) {
      assetId = created.id;
    } else {
      warnings.push(
        "Supabaseが未設定のため、素材のmetadataは保存されていません。",
      );
    }
  } catch (error) {
    console.error("Metadata insert failed:", error);
    warnings.push("metadataの保存に失敗しました。");
  }

  return NextResponse.json({
    ok: true,
    asset_id: assetId,
    file_url: fileUrl,
    stored_filename: storedFilename,
    simulated: true,
    warnings,
  });
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}
