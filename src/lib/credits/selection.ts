import type { CreditSelection, Musician } from "@/types/musician";
import { detectPlatform } from "@/lib/utils/sns";
import { musicianProfileUrl } from "@/lib/utils/url";

/**
 * Resolving a CreditSelection into concrete output values.
 *
 * Override fields always win; otherwise the directory (source) value is used.
 * Resolution never writes anything back — the musicians table is the source
 * of truth and credit-builder edits are per-event temporary values.
 */

export type ResolvedCreditPerson = {
  slug: string;
  nameJp: string;
  nameEn: string;
  displayName: string;
  canonicalName: string;
  role: string;
  roles: string[];
  linkPrimary: string;
  linkSecondary: string;
  publicLinks: string[];
  xUrl: string;
  youtubeUrl: string;
  websiteUrl: string;
  profileUrl: string;
  iconImageUrl: string;
};

export type ResolveOptions = {
  /** Base URL for <profile_url>. Defaults to NEXT_PUBLIC_APP_URL. */
  appUrl?: string;
};

export function resolveCreditPerson(
  selection: CreditSelection,
  options: ResolveOptions = {},
): ResolvedCreditPerson {
  const m = selection.sourceMusician;

  const sortedPublicLinks = [...m.links]
    .filter((l) => l.isPublic)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const publicLinks = dedupe(
    [
      ...(m.primarySnsUrl ? [m.primarySnsUrl] : []),
      ...sortedPublicLinks.map((l) => l.url),
      ...(m.websiteUrl ? [m.websiteUrl] : []),
    ].filter((u) => u.trim().length > 0),
  );

  const linkPrimary =
    selection.overrideLinkPrimary ?? m.primarySnsUrl ?? publicLinks[0] ?? "";
  const linkSecondary =
    selection.overrideLinkSecondary ??
    m.websiteUrl ??
    publicLinks.find((u) => u !== linkPrimary) ??
    "";

  const findByPlatform = (platform: string): string =>
    sortedPublicLinks.find((l) => l.platform === platform)?.url ??
    publicLinks.find((u) => detectPlatform(u) === platform) ??
    "";

  return {
    slug: selection.slug,
    nameJp: selection.overrideNameJp ?? m.nameJp,
    nameEn: selection.overrideNameEn ?? m.nameEn,
    displayName: selection.overrideDisplayName ?? m.displayName,
    canonicalName: m.canonicalName ?? m.nameEn,
    role: selection.overrideRole ?? m.roles[0] ?? "",
    roles: m.roles,
    linkPrimary,
    linkSecondary,
    publicLinks,
    xUrl: findByPlatform("x"),
    youtubeUrl: findByPlatform("youtube"),
    websiteUrl: m.websiteUrl ?? findByPlatform("website"),
    profileUrl: musicianProfileUrl(selection.slug, options.appUrl),
    iconImageUrl: selection.overrideIconImageUrl ?? m.iconImageUrl ?? "",
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

export function makeSelectionFromMusician(
  musician: Musician,
  order: number,
): CreditSelection {
  return {
    musicianId: musician.id,
    slug: musician.slug,
    sourceMusician: musician,
    order,
  };
}

/** True when the selection has at least one temporary override. */
export function hasOverrides(selection: CreditSelection): boolean {
  return (
    selection.overrideNameJp !== undefined ||
    selection.overrideNameEn !== undefined ||
    selection.overrideDisplayName !== undefined ||
    selection.overrideRole !== undefined ||
    selection.overrideLinkPrimary !== undefined ||
    selection.overrideLinkSecondary !== undefined ||
    selection.overrideIconImageUrl !== undefined
  );
}

export function sortSelections(selections: CreditSelection[]): CreditSelection[] {
  return [...selections]
    .sort((a, b) => a.order - b.order)
    .map((s, index) => ({ ...s, order: index }));
}
