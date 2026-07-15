import { detectPlatform, normalizeUrlInput } from "@/lib/utils/sns";

/**
 * Discord Modal入力の検証。
 * 未知項目はrequest全体を拒否し、許可項目はここで明示的に列挙する。
 * DB側にも同じホワイトリストがあり(musician_self_editable_fields)、
 * 確定transactionで再検証される。
 */

export type LinkOp = {
  op: "upsert" | "delete";
  url: string;
  platform?: string;
  label?: string | null;
  display_order?: number;
};

export type ValidatedProfilePayload = {
  fields: Record<string, unknown>;
  link_ops: LinkOp[];
};

export type ValidationResult =
  | { ok: true; payload: ValidatedProfilePayload }
  | { ok: false; errorCode: string; message: string };

const MAX_TEXT = 80;
const MAX_URL = 300;
const MAX_LIST_ITEMS = 10;
const MAX_PAYLOAD_BYTES = 8_000;

const BASIC_KEYS = [
  "display_name",
  "name_jp",
  "name_en",
  "roles",
  "primary_sns_url",
] as const;

const OPTIONAL_KEYS = [
  "website_url",
  "icon_image_url",
  "vrc_name",
  "aliases",
] as const;

const LINK_KEYS = ["url", "platform", "label", "display_order", "delete"] as const;

const LINK_PLATFORMS = [
  "x",
  "youtube",
  "twitch",
  "instagram",
  "soundcloud",
  "booth",
  "website",
  "other",
] as const;

function reject(errorCode: string, message: string): ValidationResult {
  return { ok: false, errorCode, message };
}

function findUnknownKey(
  inputs: Record<string, string>,
  allowed: readonly string[],
): string | null {
  for (const key of Object.keys(inputs)) {
    if (!allowed.includes(key)) return key;
  }
  return null;
}

function tooLarge(inputs: Record<string, string>): boolean {
  return Buffer.byteLength(JSON.stringify(inputs), "utf8") > MAX_PAYLOAD_BYTES;
}

function parseList(
  raw: string,
  label: string,
  maxItemLength: number,
): { ok: true; items: string[] } | { ok: false; message: string } {
  const items = raw
    .split(/[\n,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length > MAX_LIST_ITEMS) {
    return { ok: false, message: `${label}は${MAX_LIST_ITEMS}件以内にしてください。` };
  }
  for (const item of items) {
    if (item.length > maxItemLength) {
      return {
        ok: false,
        message: `${label}の各項目は${maxItemLength}文字以内にしてください。`,
      };
    }
  }
  return { ok: true, items };
}

function parseHttpUrl(
  raw: string,
  label: string,
): { ok: true; url: string } | { ok: false; message: string } {
  if (raw.length > MAX_URL) {
    return { ok: false, message: `${label}は${MAX_URL}文字以内にしてください。` };
  }
  const normalized = normalizeUrlInput(raw);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, message: `${label}は http(s) URLにしてください。` };
    }
    if (!url.hostname.includes(".")) {
      return { ok: false, message: `${label}の形式が不正です。` };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: `${label}の形式が不正です。` };
  }
}

/** 基本プロフィールModal (`display_name`〜`primary_sns_url`) の検証。 */
export function validateBasicProfileInputs(
  inputs: Record<string, string>,
): ValidationResult {
  const unknown = findUnknownKey(inputs, BASIC_KEYS);
  if (unknown) return reject("unknown_field", `不明な項目です: ${unknown}`);
  if (tooLarge(inputs)) return reject("payload_too_large", "入力が大きすぎます。");

  const fields: Record<string, unknown> = {};

  const displayName = (inputs.display_name ?? "").trim();
  if (!displayName) return reject("missing_field", "表示名は必須です。");
  if (displayName.length > MAX_TEXT) {
    return reject("field_too_long", `表示名は${MAX_TEXT}文字以内にしてください。`);
  }
  fields.display_name = displayName;

  const nameJp = (inputs.name_jp ?? "").trim();
  if (!nameJp) return reject("missing_field", "日本語名は必須です。");
  if (nameJp.length > MAX_TEXT) {
    return reject("field_too_long", `日本語名は${MAX_TEXT}文字以内にしてください。`);
  }
  fields.name_jp = nameJp;

  const nameEn = (inputs.name_en ?? "").trim();
  if (!nameEn) return reject("missing_field", "英語名は必須です。");
  if (nameEn.length > MAX_TEXT) {
    return reject("field_too_long", `英語名は${MAX_TEXT}文字以内にしてください。`);
  }
  fields.name_en = nameEn;

  const rolesResult = parseList(inputs.roles ?? "", "担当", 40);
  if (!rolesResult.ok) return reject("field_too_long", rolesResult.message);
  if (rolesResult.items.length === 0) {
    return reject("missing_field", "担当を1つ以上入力してください。");
  }
  fields.roles = rolesResult.items;

  const primarySns = (inputs.primary_sns_url ?? "").trim();
  if (primarySns) {
    const urlResult = parseHttpUrl(primarySns, "主SNS URL");
    if (!urlResult.ok) return reject("invalid_url", urlResult.message);
    fields.primary_sns_url = urlResult.url;
  } else {
    fields.primary_sns_url = "";
  }

  return { ok: true, payload: { fields, link_ops: [] } };
}

/** 任意項目Modal (`website_url`〜`aliases`) の検証。 */
export function validateOptionalProfileInputs(
  inputs: Record<string, string>,
): ValidationResult {
  const unknown = findUnknownKey(inputs, OPTIONAL_KEYS);
  if (unknown) return reject("unknown_field", `不明な項目です: ${unknown}`);
  if (tooLarge(inputs)) return reject("payload_too_large", "入力が大きすぎます。");

  const fields: Record<string, unknown> = {};

  for (const [key, label] of [
    ["website_url", "Web URL"],
    ["icon_image_url", "アイコンURL"],
  ] as const) {
    if (!(key in inputs)) continue;
    const raw = (inputs[key] ?? "").trim();
    if (!raw) {
      fields[key] = "";
      continue;
    }
    const urlResult = parseHttpUrl(raw, label);
    if (!urlResult.ok) return reject("invalid_url", urlResult.message);
    fields[key] = urlResult.url;
  }

  if ("vrc_name" in inputs) {
    const vrcName = (inputs.vrc_name ?? "").trim();
    if (vrcName.length > MAX_TEXT) {
      return reject("field_too_long", `VRChat名は${MAX_TEXT}文字以内にしてください。`);
    }
    fields.vrc_name = vrcName;
  }

  if ("aliases" in inputs) {
    const aliasesResult = parseList(inputs.aliases ?? "", "別名義", MAX_TEXT);
    if (!aliasesResult.ok) return reject("field_too_long", aliasesResult.message);
    fields.aliases = aliasesResult.items;
  }

  return { ok: true, payload: { fields, link_ops: [] } };
}

/** 追加リンクModal (1リンクの追加・更新・削除指定) の検証。 */
export function validateLinkInputs(
  inputs: Record<string, string>,
): ValidationResult {
  const unknown = findUnknownKey(inputs, LINK_KEYS);
  if (unknown) return reject("unknown_field", `不明な項目です: ${unknown}`);
  if (tooLarge(inputs)) return reject("payload_too_large", "入力が大きすぎます。");

  const rawUrl = (inputs.url ?? "").trim();
  if (!rawUrl) return reject("missing_field", "リンクURLは必須です。");
  const urlResult = parseHttpUrl(rawUrl, "リンクURL");
  if (!urlResult.ok) return reject("invalid_url", urlResult.message);

  const deleteFlag = (inputs.delete ?? "").trim().toLowerCase();
  if (deleteFlag && !["削除", "delete", "yes"].includes(deleteFlag)) {
    return reject(
      "invalid_field",
      "削除指定には「削除」とだけ入力してください。",
    );
  }
  if (deleteFlag) {
    return {
      ok: true,
      payload: { fields: {}, link_ops: [{ op: "delete", url: urlResult.url }] },
    };
  }

  const rawPlatform = (inputs.platform ?? "").trim().toLowerCase();
  let platform: string;
  if (!rawPlatform) {
    platform = detectPlatform(urlResult.url);
  } else if ((LINK_PLATFORMS as readonly string[]).includes(rawPlatform)) {
    platform = rawPlatform;
  } else {
    return reject(
      "invalid_field",
      `platformは ${LINK_PLATFORMS.join(" / ")} のいずれかにしてください。`,
    );
  }

  const label = (inputs.label ?? "").trim();
  if (label.length > MAX_TEXT) {
    return reject("field_too_long", `ラベルは${MAX_TEXT}文字以内にしてください。`);
  }

  const rawOrder = (inputs.display_order ?? "").trim();
  let displayOrder = 0;
  if (rawOrder) {
    if (!/^\d{1,3}$/.test(rawOrder)) {
      return reject("invalid_field", "表示順は0〜999の整数にしてください。");
    }
    displayOrder = Number(rawOrder);
  }

  return {
    ok: true,
    payload: {
      fields: {},
      link_ops: [
        {
          op: "upsert",
          url: urlResult.url,
          platform,
          label: label || null,
          display_order: displayOrder,
        },
      ],
    },
  };
}

/** 既存sessionのpayloadへ新しい検証済みpayloadを重ねる。 */
export function mergeValidatedPayloads(
  base: ValidatedProfilePayload,
  update: ValidatedProfilePayload,
): ValidatedProfilePayload {
  const fields = { ...base.fields, ...update.fields };
  const linkOps = [...base.link_ops];
  for (const op of update.link_ops) {
    const index = linkOps.findIndex((existing) => existing.url === op.url);
    if (index >= 0) linkOps[index] = op;
    else linkOps.push(op);
  }
  return { fields, link_ops: linkOps };
}
