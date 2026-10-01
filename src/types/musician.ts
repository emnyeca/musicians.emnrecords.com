/**
 * Domain types for the EMN Records Musician Directory & Credit Builder.
 *
 * Naming policy:
 * - DB (MySQL) uses snake_case, app code uses camelCase.
 * - "roles" is the single field for what a person does (instrument / role are
 *   NOT separated in this app). There is no `instruments` field by design.
 */

export type MusicianVisibility = "public" | "draft" | "hidden";
export type DirectoryCategory = "musician" | "creator/staff";

export type IconImageSource =
  | "external_url"
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
  roleChoices?: string[] | null;
  otherRole?: string;
  roleTags?: string[];
  directoryCategories?: DirectoryCategory[];
  id: string;
  slug: string;
  /** Name mainly shown on cards and lists. */
  displayName: string;
  /** Optional Japanese name; blank if the artist does not use one. */
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
  /** Square icon image URL (X profile icon, ConoHa URL, ...). */
  iconImageUrl: string | null;
  iconImageSource: IconImageSource;
  iconStoragePath: string | null;
  vrcName: string | null;
  discordName: string | null;
  visibility: MusicianVisibility;
  links: MusicianLink[];
};

/**
 * One selected person inside the credit builder.
 *
 * Override fields are TEMPORARY output values for the current event only.
 * They must never be written back to the musicians table — the musicians
 * table is the directory's source of truth.
 */
export type CreditSelection = {
  sourceKind?: "directory" | "guest";
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

export type CreditGuest = {
  id: string;
  displayName: string;
  nameJp: string;
  nameEn: string;
  role: string;
  linkPrimary: string;
  linkSecondary: string;
  iconImageUrl: string;
};

export type CreditOutputFormat =
  | "english_minimal" | "english_names" | "english_roles" | "english_links" | "english_full"
  | "english_markdown" | "english_discord" | "english_html"
  | "japanese_names" | "japanese_roles" | "bilingual"
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
