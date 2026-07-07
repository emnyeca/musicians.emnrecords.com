import type { StandingAsset } from "@/types/musician";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapStandingAssetRow,
  type StandingAssetRow,
} from "@/lib/supabase/mappers";
import { mockStandingAssets } from "@/lib/data/mock-standing-assets";

/**
 * Standing asset fetchers.
 *
 * members_only assets are only read from password-gated server code
 * (member page / download route). They must never be returned to public
 * directory pages.
 */

const ASSET_SELECT =
  "*, musicians(id, slug, display_name, name_jp, name_en, roles, icon_image_url)";

/** All active assets (public + members_only) for the gated member page. */
export async function getStandingAssetsForMembers(): Promise<StandingAsset[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockStandingAssets.filter((a) => a.isActive);
  }
  const { data, error } = await supabase
    .from("standing_assets")
    .select(ASSET_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to fetch standing assets:", error.message);
    return [];
  }
  return ((data ?? []) as StandingAssetRow[]).map(mapStandingAssetRow);
}

/** Public assets only — safe for the public musician detail page. */
export async function getPublicStandingAssetsForMusician(
  musicianId: string,
): Promise<StandingAsset[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockStandingAssets.filter(
      (a) =>
        a.musicianId === musicianId && a.visibility === "public" && a.isActive,
    );
  }
  const { data, error } = await supabase
    .from("standing_assets")
    .select(ASSET_SELECT)
    .eq("musician_id", musicianId)
    .eq("visibility", "public")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to fetch public standing assets:", error.message);
    return [];
  }
  return ((data ?? []) as StandingAssetRow[]).map(mapStandingAssetRow);
}

export async function getStandingAssetById(
  id: string,
): Promise<StandingAsset | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockStandingAssets.find((a) => a.id === id && a.isActive) ?? null;
  }
  const { data, error } = await supabase
    .from("standing_assets")
    .select(ASSET_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch standing asset:", error.message);
    return null;
  }
  return data ? mapStandingAssetRow(data as StandingAssetRow) : null;
}

export async function countActiveAssetsForMusician(
  musicianId: string,
): Promise<number | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockStandingAssets.filter(
      (a) => a.musicianId === musicianId && a.isActive,
    ).length;
  }
  const { count, error } = await supabase
    .from("standing_assets")
    .select("id", { count: "exact", head: true })
    .eq("musician_id", musicianId)
    .eq("is_active", true);
  if (error) {
    console.error("Failed to count standing assets:", error.message);
    return null;
  }
  return count ?? 0;
}

export type NewStandingAssetRecord = {
  musicianId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  storageBackend: string;
  wpMediaId: number | null;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  visibility: "public" | "members_only";
  accessNote: string | null;
  allowCreditUse: boolean;
  allowThumbnailUse: boolean;
  allowCropping: boolean;
  allowColorAdjustment: boolean;
  requireCredit: boolean;
  creditText: string | null;
  usageTerms: string | null;
};

/**
 * Inserts asset metadata after a successful WordPress upload.
 * Returns the created id, or null when Supabase is not configured.
 */
export async function createStandingAsset(
  record: NewStandingAssetRecord,
): Promise<{ id: string } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("standing_assets")
    .insert({
      musician_id: record.musicianId,
      title: record.title,
      description: record.description,
      file_url: record.fileUrl,
      storage_backend: record.storageBackend,
      wp_media_id: record.wpMediaId,
      original_filename: record.originalFilename,
      stored_filename: record.storedFilename,
      mime_type: record.mimeType,
      file_size_bytes: record.fileSizeBytes,
      visibility: record.visibility,
      access_note: record.accessNote,
      allow_credit_use: record.allowCreditUse,
      allow_thumbnail_use: record.allowThumbnailUse,
      allow_cropping: record.allowCropping,
      allow_color_adjustment: record.allowColorAdjustment,
      require_credit: record.requireCredit,
      credit_text: record.creditText,
      usage_terms: record.usageTerms,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Failed to insert standing asset metadata: ${error.message}`);
  }
  return { id: (data as { id: string }).id };
}
