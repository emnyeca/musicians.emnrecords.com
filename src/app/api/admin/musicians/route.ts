import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { hasValidAccess } from "@/lib/assets/access";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getSupabaseServerClient,
  hasSupabaseServiceRole,
} from "@/lib/supabase/server";
import { detectPlatform, normalizeUrlInput } from "@/lib/utils/sns";
import { slugifyWithFallback } from "@/lib/utils/slugify";

export const runtime = "nodejs";

type CreateMusicianPayload = {
  slug?: unknown;
  displayName?: unknown;
  nameJp?: unknown;
  nameEn?: unknown;
  canonicalName?: unknown;
  sortName?: unknown;
  aliases?: unknown;
  roles?: unknown;
  primarySnsUrl?: unknown;
  websiteUrl?: unknown;
  iconImageUrl?: unknown;
  vrcName?: unknown;
  discordName?: unknown;
  visibility?: unknown;
  isVerified?: unknown;
  links?: unknown;
};

type LinkInput = {
  platform: string;
  label: string | null;
  url: string;
  display_order: number;
  is_public: boolean;
};

export async function POST(request: NextRequest) {
  if (!(await hasValidAccess("admin"))) {
    return NextResponse.json(
      { ok: false, error: "管理者パスワードでの認証が必要です。" },
      { status: 401 },
    );
  }
  if (!isSupabaseConfigured() || !hasSupabaseServiceRole()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase URL / publishable key / service role key がサーバーに設定されていません。",
      },
      { status: 503 },
    );
  }

  let body: CreateMusicianPayload;
  try {
    body = (await request.json()) as CreateMusicianPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const displayName = text(body.displayName);
  const nameJp = text(body.nameJp);
  const nameEn = text(body.nameEn);
  if (!displayName || !nameJp || !nameEn) {
    return NextResponse.json(
      { ok: false, error: "表示名・日本語名・英語名は必須です。" },
      { status: 400 },
    );
  }

  const slug = slugifyWithFallback(
    text(body.slug) || nameEn || displayName,
    displayName,
  );
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "slugを生成できませんでした。英数字のslugを入力してください。" },
      { status: 400 },
    );
  }

  const roles = list(body.roles);
  if (roles.length === 0) {
    return NextResponse.json(
      { ok: false, error: "担当を1つ以上入力してください。" },
      { status: 400 },
    );
  }

  const primarySnsUrl = optionalUrl(body.primarySnsUrl, "主SNS URL");
  const websiteUrl = optionalUrl(body.websiteUrl, "Web URL");
  const iconImageUrl = optionalUrl(body.iconImageUrl, "アイコンURL");
  const urlError = [primarySnsUrl, websiteUrl, iconImageUrl].find(
    (value): value is { error: string } =>
      typeof value === "object" && value !== null && "error" in value,
  );
  if (urlError) {
    return NextResponse.json(
      { ok: false, error: urlError.error },
      { status: 400 },
    );
  }

  const extraLinksOrError = parseLinks(body.links);
  if ("error" in extraLinksOrError) {
    return NextResponse.json(
      { ok: false, error: extraLinksOrError.error },
      { status: 400 },
    );
  }

  const visibility =
    text(body.visibility) === "public"
      ? "public"
      : text(body.visibility) === "hidden"
        ? "hidden"
        : "draft";

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase clientを作成できませんでした。" },
      { status: 503 },
    );
  }

  const { data: created, error: musicianError } = await supabase
    .from("musicians")
    .insert({
      slug,
      display_name: displayName,
      name_jp: nameJp,
      name_en: nameEn,
      canonical_name: nullable(text(body.canonicalName)),
      sort_name: nullable(text(body.sortName)) ?? displayName,
      aliases: list(body.aliases),
      roles,
      primary_sns_url: valueOrNull(primarySnsUrl),
      website_url: valueOrNull(websiteUrl),
      icon_image_url: valueOrNull(iconImageUrl),
      icon_image_source: valueOrNull(iconImageUrl) ? "external_url" : "none",
      vrc_name: nullable(text(body.vrcName)),
      discord_name: nullable(text(body.discordName)),
      visibility,
      is_verified: body.isVerified === true,
    })
    .select("id, slug")
    .single();

  if (musicianError || !created) {
    return NextResponse.json(
      {
        ok: false,
        error:
          musicianError?.code === "23505"
            ? "同じslugのミュージシャンが既に存在します。"
            : (musicianError?.message ?? "ミュージシャンの作成に失敗しました。"),
      },
      { status: 400 },
    );
  }

  const linkRecords = buildLinkRecords({
    musicianId: created.id,
    primarySnsUrl: valueOrNull(primarySnsUrl),
    websiteUrl: valueOrNull(websiteUrl),
    extraLinks: extraLinksOrError.links,
  });

  if (linkRecords.length > 0) {
    const { error: linkError } = await supabase
      .from("musician_links")
      .insert(linkRecords);
    if (linkError) {
      await supabase.from("musicians").delete().eq("id", created.id);
      return NextResponse.json(
        { ok: false, error: `リンクの作成に失敗しました: ${linkError.message}` },
        { status: 400 },
      );
    }
  }

  revalidatePath("/musicians");
  revalidatePath(`/musicians/${created.slug}`);

  return NextResponse.json({
    ok: true,
    musician: {
      id: created.id,
      slug: created.slug,
      url: `/musicians/${created.slug}`,
    },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}

function list(value: unknown): string[] {
  return text(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalUrl(
  value: unknown,
  label: string,
): string | null | { error: string } {
  const raw = text(value);
  if (!raw) return null;
  const normalized = normalizeUrlInput(raw);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: `${label}は http(s) URLにしてください。` };
    }
    return url.toString();
  } catch {
    return { error: `${label}の形式が不正です。` };
  }
}

function valueOrNull(value: string | null | { error: string }): string | null {
  return typeof value === "string" ? value : null;
}

function parseLinks(value: unknown): { links: LinkInput[] } | { error: string } {
  const lines = text(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const links: LinkInput[] = [];
  for (const [index, line] of lines.entries()) {
    const [left, ...rest] = line.split("|").map((part) => part.trim());
    const hasLabel = rest.length > 0;
    const label = hasLabel ? left : "";
    const rawUrl = hasLabel ? rest.join("|").trim() : left;
    const url = optionalUrl(rawUrl, `追加リンク ${index + 1}`);
    if (typeof url !== "string") {
      return { error: url?.error ?? `追加リンク ${index + 1}の形式が不正です。` };
    }
    links.push({
      platform: detectPlatform(url),
      label: label || null,
      url,
      display_order: (index + 3) * 10,
      is_public: true,
    });
  }
  return { links };
}

function buildLinkRecords({
  musicianId,
  primarySnsUrl,
  websiteUrl,
  extraLinks,
}: {
  musicianId: string;
  primarySnsUrl: string | null;
  websiteUrl: string | null;
  extraLinks: LinkInput[];
}) {
  const records: Array<LinkInput & { musician_id: string }> = [];
  const seen = new Set<string>();
  function add(link: LinkInput) {
    if (seen.has(link.url)) return;
    seen.add(link.url);
    records.push({ ...link, musician_id: musicianId });
  }
  if (primarySnsUrl) {
    add({
      platform: detectPlatform(primarySnsUrl),
      label: null,
      url: primarySnsUrl,
      display_order: 10,
      is_public: true,
    });
  }
  if (websiteUrl) {
    add({
      platform: "website",
      label: "Web",
      url: websiteUrl,
      display_order: 20,
      is_public: true,
    });
  }
  for (const link of extraLinks) add(link);
  return records;
}
