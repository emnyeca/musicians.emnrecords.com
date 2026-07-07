import type {
  IconImageSource,
  Musician,
  MusicianLink,
  MusicianSummary,
  MusicianVisibility,
  StandingAsset,
  StandingAssetStorageBackend,
  StandingAssetVisibility,
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

export type StandingAssetRow = {
  id: string;
  musician_id: string;
  title: string;
  description: string | null;
  file_url: string;
  storage_backend: string | null;
  wp_media_id: number | null;
  original_filename: string | null;
  stored_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  visibility: string | null;
  access_note: string | null;
  allow_credit_use: boolean | null;
  allow_thumbnail_use: boolean | null;
  allow_cropping: boolean | null;
  allow_color_adjustment: boolean | null;
  require_credit: boolean | null;
  credit_text: string | null;
  usage_terms: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  musicians?: {
    id: string;
    slug: string;
    display_name: string;
    name_jp: string;
    name_en: string;
    roles: string[] | null;
    icon_image_url: string | null;
  } | null;
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

export function mapStandingAssetRow(row: StandingAssetRow): StandingAsset {
  const musician: MusicianSummary | null = row.musicians
    ? {
        id: row.musicians.id,
        slug: row.musicians.slug,
        displayName: row.musicians.display_name,
        nameJp: row.musicians.name_jp,
        nameEn: row.musicians.name_en,
        roles: row.musicians.roles ?? [],
        iconImageUrl: row.musicians.icon_image_url,
      }
    : null;
  return {
    id: row.id,
    musicianId: row.musician_id,
    musician,
    title: row.title,
    description: row.description,
    fileUrl: row.file_url,
    storageBackend: (row.storage_backend ??
      "wordpress_media") as StandingAssetStorageBackend,
    wpMediaId: row.wp_media_id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    visibility: (row.visibility ?? "members_only") as StandingAssetVisibility,
    accessNote: row.access_note,
    allowCreditUse: row.allow_credit_use ?? true,
    allowThumbnailUse: row.allow_thumbnail_use ?? true,
    allowCropping: row.allow_cropping ?? true,
    allowColorAdjustment: row.allow_color_adjustment ?? false,
    requireCredit: row.require_credit ?? false,
    creditText: row.credit_text,
    usageTerms: row.usage_terms,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
