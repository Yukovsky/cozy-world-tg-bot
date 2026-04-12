import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BotConfig } from "../config.ts";

export function createSupabase(config: BotConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
