import type { Musician } from "@/types/musician";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { mapMusicianRow, type MusicianRow } from "@/lib/supabase/mappers";
import { mockMusicians } from "./mock-musicians";

/**
 * Musician fetchers used by server components.
 * Falls back to mock data when Supabase is not configured, so every screen
 * works in a fresh checkout with no environment variables.
 */

const MUSICIAN_SELECT = "*, musician_links(*)";

export function usesMockMusicians(): boolean {
  return !isSupabaseConfigured();
}

export async function getPublicMusicians(): Promise<Musician[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockMusicians.filter((m) => m.visibility === "public");
  }
  const { data, error } = await supabase
    .from("musicians")
    .select(MUSICIAN_SELECT)
    .eq("visibility", "public")
    .order("sort_name", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("Failed to fetch musicians from Supabase:", error.message);
    return [];
  }
  return ((data ?? []) as MusicianRow[])
    .map(mapMusicianRow)
    .map(keepPublicLinks);
}

export async function getMusicianBySlug(slug: string): Promise<Musician | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return (
      mockMusicians.find((m) => m.slug === slug && m.visibility === "public") ??
      null
    );
  }
  const { data, error } = await supabase
    .from("musicians")
    .select(MUSICIAN_SELECT)
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch musician from Supabase:", error.message);
    return null;
  }
  return data ? keepPublicLinks(mapMusicianRow(data as MusicianRow)) : null;
}

/** Public pages must never leak non-public links. */
function keepPublicLinks(musician: Musician): Musician {
  return { ...musician, links: musician.links.filter((l) => l.isPublic) };
}
