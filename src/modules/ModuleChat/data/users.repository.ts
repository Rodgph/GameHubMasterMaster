import { getSupabaseClient } from "../../../core/services/supabase";

export type ChatUser = {
  id: string;
  username: string;
  avatar_url?: string | null;
};

export type ChatProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
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

export async function getChatProfileById(userId: string): Promise<ChatProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_profiles")
    .select("id, username, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ChatProfile | null;
}

export async function updateMyChatProfile(params: {
  userId: string;
  username: string;
  avatarUrl: string | null;
}) {
  const supabase = getSupabaseClient();
  const username = params.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("Username deve ter 3-20 caracteres [a-z0-9_].");
  }

  const { data, error } = await supabase
    .from("chat_profiles")
    .upsert(
      {
        id: params.userId,
        username,
        avatar_url: params.avatarUrl,
      },
      { onConflict: "id" },
    )
    .select("id, username, avatar_url")
    .single();

  if (error) throw error;
  return data as ChatProfile;
}
