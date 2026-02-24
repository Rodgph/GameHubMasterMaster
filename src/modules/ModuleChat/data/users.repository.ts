import { cloudApiFetch } from "../../../core/services/cloudflareApi";
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

type CloudApiUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Sessao invalida.");
  }
  return token;
}

function mapToChatUser(user: CloudApiUser): ChatUser {
  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
  };
}

function mapToChatProfile(user: CloudApiUser): ChatProfile {
  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
  };
}

export async function fetchChatUsers(): Promise<ChatUser[]> {
  const token = await getAccessToken();
  const result = await cloudApiFetch<{ users: CloudApiUser[] }>("/users?limit=50", token, {
    method: "GET",
  });
  return result.users.map(mapToChatUser);
}

export async function searchChatUsers(query: string, limit = 20): Promise<ChatUser[]> {
  const term = query.trim().replace(/^@+/, "");
  if (!term) return [];

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const token = await getAccessToken();
  const result = await cloudApiFetch<{ users: CloudApiUser[] }>(
    `/users?q=${encodeURIComponent(term)}&limit=${safeLimit}`,
    token,
    {
      method: "GET",
    },
  );
  return result.users.map(mapToChatUser);
}

export async function getChatProfileById(userId: string): Promise<ChatProfile | null> {
  const token = await getAccessToken();
  const result = await cloudApiFetch<{ user: CloudApiUser | null }>(
    `/users/${encodeURIComponent(userId)}`,
    token,
    {
      method: "GET",
    },
  );
  if (!result.user) return null;
  return mapToChatProfile(result.user);
}

export async function getChatProfilesByIds(userIds: string[]): Promise<ChatProfile[]> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const token = await getAccessToken();
  const result = await cloudApiFetch<{ users: CloudApiUser[] }>(
    `/users/by-ids?ids=${encodeURIComponent(ids.join(","))}`,
    token,
    {
      method: "GET",
    },
  );
  return result.users.map(mapToChatProfile);
}

export async function updateMyChatProfile(params: {
  userId: string;
  username: string;
  avatarUrl: string | null;
}) {
  void params.userId;
  const username = params.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("Username deve ter 3-20 caracteres [a-z0-9_].");
  }

  const token = await getAccessToken();
  const result = await cloudApiFetch<{ user: CloudApiUser }>(
    "/users/me",
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        username,
        avatarUrl: params.avatarUrl,
      }),
    },
  );
  return mapToChatProfile(result.user);
}
