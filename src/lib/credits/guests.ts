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

export function validateGuest(value: CreditGuest): CreditGuest {
  const result = { ...value };
  for (const key of ["displayName", "nameJp", "nameEn", "role"] as const) {
    result[key] = result[key].trim();
    if (result[key].length > 200) throw new Error("名前・担当は200文字以内で入力してください。");
  }
  if (!result.displayName) throw new Error("表示名を入力してください。");
  for (const key of ["linkPrimary", "linkSecondary", "iconImageUrl"] as const) {
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
      discordName: null, visibility: "hidden", isVerified: false,
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
