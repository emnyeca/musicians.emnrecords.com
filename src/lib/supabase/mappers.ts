import type {
  IconImageSource,
  Musician,
  MusicianLink,
  MusicianVisibility,
} from "@/types/musician";

/** Supabase row shapes (snake_case) and mapping into domain types. */

export type MusicianLinkRow = {
  id: string;
  musician_id: string;
  platform: string | null;
  label: string | null;
  url: string;
  display_order: number | null;
  is_public: boolean | null;
};

export type MusicianRow = {
  id: string;
  slug: string;
  display_name: string;
  name_jp: string;
  name_en: string;
  canonical_name: string | null;
  sort_name: string | null;
  aliases: string[] | null;
  roles: string[] | null;
  primary_sns_url: string | null;
  website_url: string | null;
  icon_image_url: string | null;
  icon_image_source: string | null;
  icon_storage_path: string | null;
  vrc_name: string | null;
  discord_name: string | null;
  visibility: string | null;
  is_verified: boolean | null;
  musician_links?: MusicianLinkRow[] | null;
};

export function mapMusicianLinkRow(row: MusicianLinkRow): MusicianLink {
  return {
    id: row.id,
    musicianId: row.musician_id,
    platform: row.platform ?? "other",
    label: row.label,
    url: row.url,
    displayOrder: row.display_order ?? 0,
    isPublic: row.is_public ?? false,
  };
}

export function mapMusicianRow(row: MusicianRow): Musician {
  const links = (row.musician_links ?? [])
    .map(mapMusicianLinkRow)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    nameJp: row.name_jp,
    nameEn: row.name_en,
    canonicalName: row.canonical_name,
    sortName: row.sort_name,
    aliases: row.aliases ?? [],
    roles: row.roles ?? [],
    primarySnsUrl: row.primary_sns_url,
    websiteUrl: row.website_url,
    iconImageUrl: row.icon_image_url,
    iconImageSource: (row.icon_image_source ?? "none") as IconImageSource,
    iconStoragePath: row.icon_storage_path,
    vrcName: row.vrc_name,
    discordName: row.discord_name,
    visibility: (row.visibility ?? "draft") as MusicianVisibility,
    isVerified: row.is_verified ?? false,
    links,
  };
}
