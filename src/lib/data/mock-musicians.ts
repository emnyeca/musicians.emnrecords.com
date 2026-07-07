import type { Musician, MusicianLink } from "@/types/musician";

/**
 * Mock musicians used when Supabase is not configured.
 *
 * These entries mirror the shape of real directory data so they can be
 * replaced 1:1 later (same fields, same slug policy). Names that reference
 * real people (Emnyeca, Sheena) come from the spec examples and are safe to
 * swap out by editing this file only.
 */

function link(
  musicianId: string,
  index: number,
  platform: string,
  url: string,
  label: string | null = null,
): MusicianLink {
  return {
    id: `${musicianId}-link-${index}`,
    musicianId,
    platform,
    label,
    url,
    displayOrder: index,
    isPublic: true,
  };
}

function musician(
  input: Omit<
    Musician,
    | "canonicalName"
    | "sortName"
    | "aliases"
    | "websiteUrl"
    | "iconImageUrl"
    | "iconImageSource"
    | "iconStoragePath"
    | "vrcName"
    | "discordName"
    | "visibility"
    | "isVerified"
    | "links"
  > &
    Partial<Musician>,
): Musician {
  return {
    canonicalName: input.nameEn,
    sortName: input.nameEn.toLowerCase(),
    aliases: [],
    websiteUrl: null,
    iconImageUrl: null,
    iconImageSource: "none",
    iconStoragePath: null,
    vrcName: null,
    discordName: null,
    visibility: "public",
    isVerified: true,
    links: [],
    ...input,
  };
}

export const mockMusicians: Musician[] = [
  musician({
    id: "mock-emnyeca",
    slug: "emnyeca",
    displayName: "アムニェカ",
    nameJp: "アムニェカ",
    nameEn: "Emnyeca",
    roles: ["Guitar"],
    primarySnsUrl: "https://x.com/emnyeca",
    websiteUrl: "https://emnyeca.com",
    iconImageUrl: "https://placehold.co/400x400/f3d9e2/222222.png?text=EM",
    iconImageSource: "external_url",
    vrcName: "Emnyeca",
    links: [
      link("mock-emnyeca", 1, "x", "https://x.com/emnyeca"),
      link("mock-emnyeca", 2, "website", "https://emnyeca.com"),
    ],
  }),
  musician({
    id: "mock-sheena",
    slug: "sheena-baobab",
    displayName: "しーな",
    nameJp: "しーな",
    nameEn: "Sheena_baobab",
    roles: ["Vocal"],
    primarySnsUrl: "https://x.com/sheena_baobab",
    iconImageUrl: "https://placehold.co/400x400/e8e4e4/222222.png?text=SH",
    iconImageSource: "external_url",
    links: [
      link("mock-sheena", 1, "x", "https://x.com/sheena_baobab"),
      link("mock-sheena", 2, "youtube", "https://youtube.com/@sheena_baobab"),
    ],
  }),
  musician({
    id: "mock-hoshikage",
    slug: "hoshikage",
    displayName: "ホシカゲ",
    nameJp: "ホシカゲ",
    nameEn: "Hoshikage",
    roles: ["Piano", "Keyboard"],
    primarySnsUrl: "https://x.com/hoshikage_vr",
    links: [link("mock-hoshikage", 1, "x", "https://x.com/hoshikage_vr")],
  }),
  musician({
    id: "mock-yorunoto",
    slug: "yorunoto",
    displayName: "ヨルノオト",
    nameJp: "ヨルノオト",
    nameEn: "Yorunoto",
    roles: ["Bass"],
    primarySnsUrl: "https://x.com/yorunoto_bass",
    links: [
      link("mock-yorunoto", 1, "x", "https://x.com/yorunoto_bass"),
      link("mock-yorunoto", 2, "soundcloud", "https://soundcloud.com/yorunoto"),
    ],
  }),
  musician({
    id: "mock-kanade",
    slug: "kanade-drums",
    displayName: "カナデ",
    nameJp: "カナデ",
    nameEn: "Kanade",
    roles: ["Drums"],
    primarySnsUrl: "https://x.com/kanade_drums",
    links: [link("mock-kanade", 1, "x", "https://x.com/kanade_drums")],
  }),
  musician({
    id: "mock-luca",
    slug: "luca-sax",
    displayName: "Luca",
    nameJp: "ルカ",
    nameEn: "Luca",
    roles: ["Saxophone"],
    primarySnsUrl: "https://x.com/luca_vrsax",
    websiteUrl: "https://luca-sax.example.com",
    links: [
      link("mock-luca", 1, "x", "https://x.com/luca_vrsax"),
      link("mock-luca", 2, "website", "https://luca-sax.example.com"),
    ],
  }),
  musician({
    id: "mock-mizuki",
    slug: "mizuki",
    displayName: "みづき",
    nameJp: "みづき",
    nameEn: "Mizuki",
    roles: ["Vocal", "Songwriting"],
    primarySnsUrl: "https://x.com/mizuki_sings",
    links: [
      link("mock-mizuki", 1, "x", "https://x.com/mizuki_sings"),
      link("mock-mizuki", 2, "youtube", "https://youtube.com/@mizuki_sings"),
    ],
  }),
  musician({
    id: "mock-torii",
    slug: "torii",
    displayName: "トリイ",
    nameJp: "トリイ",
    nameEn: "Torii",
    roles: ["Trumpet"],
    primarySnsUrl: "https://x.com/torii_tp",
    links: [link("mock-torii", 1, "x", "https://x.com/torii_tp")],
  }),
  musician({
    id: "mock-aoi",
    slug: "aoi-violin",
    displayName: "あおい",
    nameJp: "あおい",
    nameEn: "Aoi",
    roles: ["Violin"],
    primarySnsUrl: "https://x.com/aoi_vln",
    links: [link("mock-aoi", 1, "x", "https://x.com/aoi_vln")],
  }),
  musician({
    id: "mock-rei",
    slug: "rei-dj",
    displayName: "Rei",
    nameJp: "レイ",
    nameEn: "Rei",
    roles: ["DJ", "Track Making"],
    primarySnsUrl: "https://x.com/rei_djset",
    links: [
      link("mock-rei", 1, "x", "https://x.com/rei_djset"),
      link("mock-rei", 2, "soundcloud", "https://soundcloud.com/rei-djset"),
    ],
  }),
];
