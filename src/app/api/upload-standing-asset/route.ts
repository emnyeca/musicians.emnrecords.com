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
import {
  isWordPressConfigured,
  uploadToWordPressMedia,
} from "@/lib/wordpress/media-upload";
import { makeStoredFilename } from "@/lib/utils/file";
import { slugifyWithFallback } from "@/lib/utils/slugify";

export const runtime = "nodejs";

/**
 * Standing asset upload:
 *   browser → this route → WordPress REST API (/wp/v2/media) → ConoHa uploads
 *   → metadata insert into Supabase standing_assets.
 *
 * Protected by the upload password gate (separate from the download one).
 * The WordPress Application Password stays server-side.
 *
 * NOTE (Vercel): serverless request bodies are limited to ~4.5MB on Vercel,
 * so 20MB uploads only work when self-hosted / local. See README.
 */
export async function POST(request: NextRequest) {
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

  const musicianField = text(form, "musicianId"); // "<id>::<slug>"
  const [musicianId, musicianSlug = ""] = musicianField.split("::");
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
        error: `1人あたりの素材登録は最大${MAX_ASSETS_PER_MUSICIAN}件です。不要な素材を整理してから登録してください。`,
      },
      { status: 400 },
    );
  }

  const visibilityInput = text(form, "visibility");
  const visibility =
    visibilityInput === "public" ? ("public" as const) : ("members_only" as const);

  const storedFilename = makeStoredFilename(
    slugifyWithFallback(musicianSlug, "asset"),
    validation.extension,
  );

  // 1) Upload the file to WordPress (or simulate in local development).
  let fileUrl: string;
  let wpMediaId: number | null = null;
  let simulated = false;
  if (isWordPressConfigured()) {
    try {
      const uploaded = await uploadToWordPressMedia({
        fileBuffer: await file.arrayBuffer(),
        storedFilename,
        mimeType: file.type,
        title: `${title} (standing asset)`,
      });
      fileUrl = uploaded.sourceUrl;
      wpMediaId = uploaded.mediaId;
    } catch (error) {
      console.error("WordPress upload failed:", error);
      return NextResponse.json(
        { ok: false, error: "WordPressへのアップロードに失敗しました。" },
        { status: 502 },
      );
    }
  } else if (process.env.NODE_ENV !== "production") {
    simulated = true;
    fileUrl = `https://wordpress.example.invalid/wp-content/uploads/${storedFilename}`;
  } else {
    return NextResponse.json(
      { ok: false, error: "WordPressアップロードがサーバーに設定されていません。" },
      { status: 503 },
    );
  }

  // 2) Save metadata into Supabase.
  const warnings: string[] = [];
  let assetId: string | null = null;
  try {
    const created = await createStandingAsset({
      musicianId,
      title,
      description: nullable(text(form, "description")),
      fileUrl,
      storageBackend: "wordpress_media",
      wpMediaId,
      originalFilename: file.name,
      storedFilename,
      mimeType: file.type,
      fileSizeBytes: file.size,
      visibility,
      accessNote: nullable(text(form, "accessNote")),
      allowCreditUse: text(form, "allowCreditUse") === "true",
      allowThumbnailUse: text(form, "allowThumbnailUse") === "true",
      allowCropping: text(form, "allowCropping") === "true",
      allowColorAdjustment: text(form, "allowColorAdjustment") === "true",
      requireCredit: text(form, "requireCredit") === "true",
      creditText: nullable(text(form, "creditText")),
      usageTerms: nullable(text(form, "usageTerms")),
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
    warnings.push(
      "ファイルはアップロードされましたが、metadataの保存に失敗しました。管理者に連絡してください。",
    );
  }

  return NextResponse.json({
    ok: true,
    assetId,
    fileUrl,
    simulated,
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
