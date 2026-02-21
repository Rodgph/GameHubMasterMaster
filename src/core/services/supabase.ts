import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Config ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
