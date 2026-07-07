import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./client";

/**
 * Server-side Supabase client.
 *
 * When SUPABASE_SECRET_KEY (service role) is set it is used so that
 * members_only standing assets — which RLS hides from anonymous clients —
 * can be read by password-gated server routes. The secret key must never be
 * exposed to the browser (no NEXT_PUBLIC prefix).
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  return createClient(config.url, secretKey ?? config.key, {
    auth: { persistSession: false },
  });
}

export function hasSupabaseServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
