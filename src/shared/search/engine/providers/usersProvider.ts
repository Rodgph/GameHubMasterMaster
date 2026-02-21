import { getSupabaseClient } from "../../../../core/services/supabase";
import type { SearchProvider, SearchResult } from "../types";

type UsersProviderDeps = {
  onOpenUser: (userId: string) => void;
  currentUserId?: string | null;
};

type ChatProfileRow = {
  id: string;
  username: string;
};

export function createUsersProvider({
  onOpenUser,
  currentUserId,
}: UsersProviderDeps): SearchProvider {
  return {
    match: (query) => query.trim().startsWith("@"),
    search: async (query) => {
      const supabase = getSupabaseClient();
      const needle = query.replace(/^@/, "").trim().toLowerCase();

      let builder = supabase
        .from("chat_profiles")
        .select("id, username")
        .order("created_at", { ascending: false });

      if (needle) {
        builder = builder.ilike("username", `${needle}%`);
      }

      const { data, error } = await builder.limit(needle ? 10 : 8);
      if (error) return [];

      return ((data ?? []) as ChatProfileRow[]).map<SearchResult>((user) => ({
        id: `user:${user.id}`,
        title: `@${user.username}`,
        subtitle: user.id === currentUserId ? "Voce" : "Abrir conversa",
        kind: "user",
        onSelect: () => onOpenUser(user.id),
      }));
    },
  };
}
