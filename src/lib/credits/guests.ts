import type { CreditGuest, CreditSelection } from "@/types/musician";
import { resolveCreditPerson } from "./selection";

export function guestUrl(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("URLは https:// または http:// で入力してください。");
  }
  return url.href;
}

/** Guest icons chosen from this device stay in this browser as small data URLs. */
const LOCAL_ICON = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const LOCAL_ICON_MAX = 200_000;

export function isLocalIcon(value: string): boolean {
  return value.startsWith("data:");
}

/** Local icons never leave the browser, so text outputs omit them. */
export function outputIconUrl(value: string): string {
  return isLocalIcon(value) ? "" : value;
}

/** Center-crops to a square and shrinks to 256px JPEG so localStorage stays small. */
export async function localIconFromFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPEG・PNG・WebPの画像を選んでください。");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("画像を読み込めませんでした。"); });
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(256, side);
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を読み込めませんでした。");
  context.fillStyle = "#fff"; context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > LOCAL_ICON_MAX) throw new Error("画像を小さくできませんでした。別の画像を選んでください。");
  return url;
}

export function validateGuest(value: CreditGuest): CreditGuest {
  const result = { ...value };
  for (const key of ["displayName", "nameJp", "nameEn", "role"] as const) {
    result[key] = result[key].trim();
    if (result[key].length > 200) throw new Error("名前・担当は200文字以内で入力してください。");
  }
  if (!result.displayName) throw new Error("表示名を入力してください。");
  if (isLocalIcon(result.iconImageUrl)) {
    if (result.iconImageUrl.length > LOCAL_ICON_MAX || !LOCAL_ICON.test(result.iconImageUrl)) throw new Error("アイコン画像を読み込めませんでした。選び直してください。");
  }
  for (const key of ["linkPrimary", "linkSecondary", "iconImageUrl"] as const) {
    if (key === "iconImageUrl" && isLocalIcon(result[key])) continue;
    if (result[key].length > 1200) throw new Error("URLは1200文字以内で入力してください。");
    result[key] = guestUrl(result[key]);
  }
  return result;
}

export function normalizeGuests(value: unknown): CreditGuest[] | null {
  if (!Array.isArray(value)) return null;
  try {
    const seen = new Set<string>();
    return value.map((item) => {
      if (!item || typeof item !== "object") throw new Error();
      for (const key of ["id", "displayName", "nameJp", "nameEn", "role", "linkPrimary", "linkSecondary", "iconImageUrl"]) {
        if (typeof item[key] !== "string") throw new Error();
      }
      if (!item.id.startsWith("guest-") || seen.has(item.id)) throw new Error();
      seen.add(item.id);
      return validateGuest(item as CreditGuest);
    });
  } catch { return null; }
}

export function guestSelection(guest: CreditGuest, order: number): CreditSelection {
  return {
    sourceKind: "guest", musicianId: guest.id, slug: "", order,
    sourceMusician: {
      id: guest.id, slug: "", displayName: guest.displayName,
      nameJp: guest.nameJp || guest.displayName, nameEn: guest.nameEn,
      roles: guest.role ? [guest.role] : [], aliases: [], links: [],
      primarySnsUrl: guest.linkPrimary || null, websiteUrl: guest.linkSecondary || null,
      iconImageUrl: guest.iconImageUrl || null, iconImageSource: guest.iconImageUrl ? "external_url" : "none",
      iconStoragePath: null, canonicalName: null, sortName: null, vrcName: null,
      discordName: null, visibility: "hidden",
    },
  };
}

export function guestFromSelection(selection: CreditSelection): CreditGuest {
  const person = resolveCreditPerson(selection);
  return validateGuest({ id: selection.musicianId, displayName: person.displayName,
    nameJp: person.nameJp, nameEn: person.nameEn, role: person.role,
    linkPrimary: person.linkPrimary, linkSecondary: person.linkSecondary,
    iconImageUrl: person.iconImageUrl });
}
