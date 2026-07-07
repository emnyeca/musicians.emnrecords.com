/**
 * Domain types for the EMN Records Musician Directory & Credit Builder.
 *
 * Naming policy:
 * - DB (Supabase) uses snake_case, app code uses camelCase.
 * - "roles" is the single field for what a person does (instrument / role are
 *   NOT separated in this app). There is no `instruments` field by design.
 */

export type MusicianVisibility = "public" | "draft" | "hidden";

export type IconImageSource =
  | "external_url"
  | "supabase_upload"
  | "conoha_url"
  | "none";

export type MusicianLink = {
  id: string;
  musicianId: string;
  /** e.g. "x" | "youtube" | "twitch" | "website" | "other" */
  platform: string;
  label: string | null;
  url: string;
  displayOrder: number;
  isPublic: boolean;
};

export type Musician = {
  id: string;
  slug: string;
  /** Name mainly shown on cards and lists. */
  displayName: string;
  /** Japanese name. The only field that is intentionally Japanese. */
  nameJp: string;
  /** English name. Everything except nameJp is English-first. */
  nameEn: string;
  canonicalName: string | null;
  sortName: string | null;
  aliases: string[];
  /** Unified "担当" — instruments and roles are one list. */
  roles: string[];
  primarySnsUrl: string | null;
  websiteUrl: string | null;
  /** Square icon image URL (X profile icon, ConoHa URL, Supabase URL, ...). */
  iconImageUrl: string | null;
  iconImageSource: IconImageSource;
  iconStoragePath: string | null;
  vrcName: string | null;
  discordName: string | null;
  visibility: MusicianVisibility;
  isVerified: boolean;
  links: MusicianLink[];
};

/** Minimal musician info embedded into other records (e.g. standing assets). */
export type MusicianSummary = Pick<
  Musician,
  "id" | "slug" | "displayName" | "nameJp" | "nameEn" | "roles" | "iconImageUrl"
>;

export type StandingAssetVisibility = "public" | "members_only";

export type StandingAssetStorageBackend =
  | "wordpress_media"
  | "supabase_storage"
  | "external";

export type StandingAsset = {
  id: string;
  musicianId: string;
  /** Joined musician info for display. Null when the join is unavailable. */
  musician: MusicianSummary | null;
  title: string;
  description: string | null;
  /**
   * Direct file URL (WordPress uploads on ConoHa in v0.1).
   * NOTE: this is a normal public URL — members_only is "limited sharing",
   * not strict private storage. Anyone who knows the URL can access it.
   */
  fileUrl: string;
  storageBackend: StandingAssetStorageBackend;
  wpMediaId: number | null;
  originalFilename: string | null;
  storedFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  visibility: StandingAssetVisibility;
  accessNote: string | null;
  allowCreditUse: boolean;
  allowThumbnailUse: boolean;
  allowCropping: boolean;
  allowColorAdjustment: boolean;
  requireCredit: boolean;
  creditText: string | null;
  usageTerms: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * One selected person inside the credit builder.
 *
 * Override fields are TEMPORARY output values for the current event only.
 * They must never be written back to the musicians table — the musicians
 * table is the directory's source of truth.
 */
export type CreditSelection = {
  musicianId: string;
  slug: string;
  /** Snapshot of the directory data at selection time. */
  sourceMusician: Musician;
  overrideNameJp?: string;
  overrideNameEn?: string;
  overrideDisplayName?: string;
  overrideRole?: string;
  overrideLinkPrimary?: string;
  overrideLinkSecondary?: string;
  overrideIconImageUrl?: string;
  order: number;
};

export type CreditOutputFormat =
  | "emn_minimal"
  | "wordpress_html"
  | "markdown"
  | "plain_text"
  | "discord"
  | "json"
  | "custom";

export type CreditCustomTemplate = {
  name: string;
  headerTemplate?: string;
  personTemplate: string;
  separator: string;
  footerTemplate?: string;
};

export type CreditExport = {
  id: string;
  title: string | null;
  eventName: string | null;
  outputFormat: CreditOutputFormat;
  outputBody: string;
  /**
   * Snapshot of the selections (including overrides) used for this export.
   * Never used to update the musicians table.
   */
  selectedPeople: CreditSelection[];
  createdBy: string | null;
  createdAt: string;
};
