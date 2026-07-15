import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — all authorization is enforced in application code.
 * Never import this into a Client Component.
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
