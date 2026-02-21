import { useEffect, useState } from "react";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { getSupabaseClient } from "../../../core/services/supabase";

export type UserSearchItem = {
  id: string;
  username: string;
  avatar_url?: string | null;
};

export function useUserSearch(query: string) {
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [users, setUsers] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needleRaw = query.startsWith("@") ? query.slice(1) : query;
    const needle = needleRaw.trim().toLowerCase();

    if (!needle) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      const run = async () => {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("chat_profiles")
          .select("id, username, avatar_url")
          .ilike("username", `${needle}%`)
          .order("created_at", { ascending: false })
          .limit(10);

        if (cancelled) return;

        if (error) {
          setUsers([]);
          setLoading(false);
          return;
        }

        const next = ((data ?? []) as UserSearchItem[]).filter((user) => user.id !== currentUserId);
        setUsers(next);
        setLoading(false);
      };

      void run();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentUserId, query]);

  return { users, loading };
}
