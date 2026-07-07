/**
 * office people.json → Webアプリ用データ変換（dry-run）
 *
 * officeリポジトリの knowledge/wordpress/credits/people.json を読み、
 * musicians / musician_links 相当のJSONに変換して標準出力へ出す。
 * v0.1では変換結果の確認（dry-run）のみ。実DBへのinsertはTODO。
 *
 * 使い方:
 *   npx tsx scripts/import-office-people.ts [path/to/people.json]
 *   （省略時: ../office/knowledge/wordpress/credits/people.json）
 *
 * 変換方針:
 * - display_name -> displayName / nameJp初期候補
 * - nameEn は自動推定しない（未設定はTODOとして出力し、人間が確定する）
 * - default_role + roles_seen -> roles（instrumentsは作らない）
 * - icon_url -> iconImageUrl（値があれば icon_image_source = external_url）
 * - primary_sns_url -> primarySnsUrl
 * - sns_urls -> musician_links
 * - person_id -> slug候補
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { slugifyWithFallback } from "../src/lib/utils/slugify";
import { detectPlatform } from "../src/lib/utils/sns";

type OfficePerson = {
  person_id?: string;
  display_name?: string;
  aliases?: string[];
  default_role?: string;
  roles_seen?: string[];
  icon_url?: string;
  primary_sns_url?: string;
  sns_urls?: string[];
  notes?: string[];
  source_count?: number;
};

type ImportedMusician = {
  slug: string;
  displayName: string;
  nameJp: string;
  /** 空文字 = 人間による確定待ち（TODO）。自動推定はしない。 */
  nameEn: string;
  aliases: string[];
  roles: string[];
  primarySnsUrl: string | null;
  iconImageUrl: string | null;
  iconImageSource: "external_url" | "none";
  visibility: "draft";
  links: {
    platform: string;
    url: string;
    displayOrder: number;
    isPublic: boolean;
  }[];
  todos: string[];
};

function convertPerson(person: OfficePerson, index: number): ImportedMusician {
  const displayName = person.display_name?.trim() ?? "";
  const todos: string[] = [];

  const slug = slugifyWithFallback(
    person.person_id ?? "",
    displayName !== "" ? displayName : `person-${index}`,
  );
  if (slug === "") {
    todos.push("slugを手動で決める必要があります（ASCII化できない名前）");
  }

  const roles = dedupe(
    [person.default_role ?? "", ...(person.roles_seen ?? [])]
      .map((r) => r.trim())
      .filter((r) => r !== ""),
  );
  if (roles.length === 0) {
    todos.push("roles（担当）が未設定です");
  }

  todos.push("nameEn（英語名）の確定が必要です");
  if (!person.icon_url) {
    todos.push("iconImageUrl（アイコン画像URL）が未設定です");
  }

  const snsUrls = dedupe(
    (person.sns_urls ?? []).map((u) => u.trim()).filter((u) => u !== ""),
  );

  return {
    slug: slug !== "" ? slug : `person-${index}`,
    displayName,
    nameJp: displayName, // 初期候補。人間が最終確認する。
    nameEn: "",
    aliases: dedupe(
      (person.aliases ?? []).filter((a) => a.trim() !== "" && a !== displayName),
    ),
    roles,
    primarySnsUrl: person.primary_sns_url?.trim() || null,
    iconImageUrl: person.icon_url?.trim() || null,
    iconImageSource: person.icon_url ? "external_url" : "none",
    visibility: "draft",
    links: snsUrls.map((url, i) => ({
      platform: detectPlatform(url),
      url,
      displayOrder: i + 1,
      isPublic: true,
    })),
    todos,
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function main() {
  const inputPath = resolve(
    process.argv[2] ?? "../office/knowledge/wordpress/credits/people.json",
  );

  let raw: string;
  try {
    raw = readFileSync(inputPath, "utf8");
  } catch {
    console.error(`people.json を読み込めません: ${inputPath}`);
    console.error(
      "使い方: npx tsx scripts/import-office-people.ts [path/to/people.json]",
    );
    process.exit(1);
  }

  const people = JSON.parse(raw) as OfficePerson[];
  const converted = people.map(convertPerson);

  // 変換結果はstdout、サマリーはstderr（リダイレクトで分離できるように）
  console.log(JSON.stringify(converted, null, 2));

  const needNameEn = converted.length; // 全員nameEn確定待ち
  const noIcon = converted.filter((m) => m.iconImageUrl === null).length;
  const noRoles = converted.filter((m) => m.roles.length === 0).length;
  console.error("");
  console.error(`--- import-office-people summary (dry-run) ---`);
  console.error(`people: ${converted.length}`);
  console.error(`nameEn未確定（人間の確認が必要）: ${needNameEn}`);
  console.error(`icon未設定: ${noIcon}`);
  console.error(`roles未設定: ${noRoles}`);
  console.error(`visibilityは全件 'draft'。公開前に人間が確認してください。`);
  console.error(`TODO: Supabaseへの実insertはv0.2で実装（現状はdry-runのみ）`);
}

main();
