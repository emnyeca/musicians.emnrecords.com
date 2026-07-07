import type { StandingAsset } from "@/types/musician";
import { mockMusicians } from "./mock-musicians";

function summaryOf(musicianId: string) {
  const m = mockMusicians.find((x) => x.id === musicianId);
  if (!m) return null;
  return {
    id: m.id,
    slug: m.slug,
    displayName: m.displayName,
    nameJp: m.nameJp,
    nameEn: m.nameEn,
    roles: m.roles,
    iconImageUrl: m.iconImageUrl,
  };
}

/**
 * Mock standing assets used when Supabase is not configured.
 * fileUrl uses a clearly fake host so nothing hits a real server by accident.
 */
export const mockStandingAssets: StandingAsset[] = [
  {
    id: "mock-asset-emnyeca-01",
    musicianId: "mock-emnyeca",
    musician: summaryOf("mock-emnyeca"),
    title: "Emnyeca standing (guitar, front)",
    description: "Full-body standing illustration with guitar.",
    fileUrl:
      "https://wordpress.example.invalid/wp-content/uploads/2026/06/emnyeca-standing-20260601-a1b2c3.png",
    storageBackend: "wordpress_media",
    wpMediaId: 90001,
    originalFilename: "emnyeca_standing_front.png",
    storedFilename: "emnyeca-standing-20260601-a1b2c3.png",
    mimeType: "image/png",
    fileSizeBytes: 18_400_000,
    visibility: "members_only",
    accessNote: "For EMN Records verified Discord members only.",
    allowCreditUse: true,
    allowThumbnailUse: true,
    allowCropping: true,
    allowColorAdjustment: false,
    requireCredit: true,
    creditText: "Illustration: courtesy of Emnyeca",
    usageTerms:
      "EMN Records related event announcements, credits, thumbnails and performer introductions only. Do not redistribute the file itself.",
    isActive: true,
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
  },
  {
    id: "mock-asset-sheena-01",
    musicianId: "mock-sheena",
    musician: summaryOf("mock-sheena"),
    title: "Sheena standing (vocal pose)",
    description: null,
    fileUrl:
      "https://wordpress.example.invalid/wp-content/uploads/2026/05/sheena-standing-20260515-d4e5f6.png",
    storageBackend: "wordpress_media",
    wpMediaId: 90002,
    originalFilename: "sheena_pose.png",
    storedFilename: "sheena-standing-20260515-d4e5f6.png",
    mimeType: "image/png",
    fileSizeBytes: 12_100_000,
    visibility: "members_only",
    accessNote: null,
    allowCreditUse: true,
    allowThumbnailUse: true,
    allowCropping: false,
    allowColorAdjustment: false,
    requireCredit: false,
    creditText: null,
    usageTerms:
      "Use for EMN Records event thumbnails and credits. Cropping is not allowed — use the full body image as is.",
    isActive: true,
    createdAt: "2026-05-15T09:30:00Z",
    updatedAt: "2026-05-15T09:30:00Z",
  },
  {
    id: "mock-asset-hoshikage-01",
    musicianId: "mock-hoshikage",
    musician: summaryOf("mock-hoshikage"),
    title: "Hoshikage standing (public)",
    description: "Public promotional standing image.",
    fileUrl:
      "https://wordpress.example.invalid/wp-content/uploads/2026/04/hoshikage-standing-20260410-g7h8i9.webp",
    storageBackend: "wordpress_media",
    wpMediaId: 90003,
    originalFilename: "hoshikage_promo.webp",
    storedFilename: "hoshikage-standing-20260410-g7h8i9.webp",
    mimeType: "image/webp",
    fileSizeBytes: 6_800_000,
    visibility: "public",
    accessNote: null,
    allowCreditUse: true,
    allowThumbnailUse: true,
    allowCropping: true,
    allowColorAdjustment: true,
    requireCredit: false,
    creditText: null,
    usageTerms: "Free to use for event announcements related to EMN Records.",
    isActive: true,
    createdAt: "2026-04-10T15:00:00Z",
    updatedAt: "2026-04-10T15:00:00Z",
  },
  {
    id: "mock-asset-mizuki-01",
    musicianId: "mock-mizuki",
    musician: summaryOf("mock-mizuki"),
    title: "Mizuki standing (stage light ver.)",
    description: "Alternative color version for dark thumbnails.",
    fileUrl:
      "https://wordpress.example.invalid/wp-content/uploads/2026/06/mizuki-standing-20260620-j1k2l3.jpg",
    storageBackend: "wordpress_media",
    wpMediaId: 90004,
    originalFilename: "mizuki_stage.jpg",
    storedFilename: "mizuki-standing-20260620-j1k2l3.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 9_300_000,
    visibility: "members_only",
    accessNote: "Ask Mizuki before using outside EMN Records events.",
    allowCreditUse: true,
    allowThumbnailUse: true,
    allowCropping: true,
    allowColorAdjustment: true,
    requireCredit: true,
    creditText: "Character art: Mizuki / EMN Records",
    usageTerms:
      "EMN Records events only. Color adjustment allowed for thumbnail integration. Credit required on published thumbnails.",
    isActive: true,
    createdAt: "2026-06-20T18:45:00Z",
    updatedAt: "2026-06-20T18:45:00Z",
  },
];
