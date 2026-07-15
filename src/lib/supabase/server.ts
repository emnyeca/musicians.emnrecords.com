import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./client";

/**
 * Server-side Supabase client.
 *
 * The service-role key is used only by operator-controlled server routes.
 * It must never be exposed to browsers, Discord interactions, or public logs.
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
