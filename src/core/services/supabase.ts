import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const appInstance = (import.meta.env.VITE_APP_INSTANCE as string | undefined) ?? "main";
const storageKey = appInstance === "alt" ? "sb-auth-alt" : "sb-auth";
let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Config ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey,
    },
  });
  return cachedClient;
}
