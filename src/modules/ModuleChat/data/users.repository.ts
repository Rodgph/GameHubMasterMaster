import { getSupabaseClient } from "../../../core/services/supabase";

export type ChatUser = {
  id: string;
  username: string;
  avatar_url?: string | null;
};

export async function fetchChatUsers(): Promise<ChatUser[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_profiles")
    .select("id, username, avatar_url")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as ChatUser[];
}
