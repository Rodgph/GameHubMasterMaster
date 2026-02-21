import { useEffect, useState } from "react";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { fetchFollowedProfiles, type FollowedProfile } from "../data/follows.repository";

export function useFollowedProfiles() {
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [profiles, setProfiles] = useState<FollowedProfile[]>([]);

  const refresh = async () => {
    if (!currentUserId) {
      setProfiles([]);
      return;
    }
    try {
      const next = await fetchFollowedProfiles(currentUserId);
      setProfiles(next);
    } catch {
      setProfiles([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, [currentUserId]);

  return { profiles, refresh };
}
