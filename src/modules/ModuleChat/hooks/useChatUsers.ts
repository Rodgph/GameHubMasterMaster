import { useCallback, useEffect, useState } from "react";
import { fetchChatUsers, type ChatUser } from "../data/users.repository";

type UseChatUsersResult = {
  users: ChatUser[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useChatUsers(): UseChatUsersResult {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchChatUsers();
      setUsers(list);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { users, loading, error, refetch };
}
