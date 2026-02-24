import { getSupabaseClient } from "../../../core/services/supabase";
import { getChatProfilesByIds } from "./users.repository";

type FollowUserParams = {
  followerId: string;
  followedId: string;
};

export type FollowedProfile = {
  id: string;
  username: string;
  avatar_url?: string | null;
};

export async function followUser({ followerId, followedId }: FollowUserParams): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("chat_follows").upsert(
    {
      follower_id: followerId,
      followed_id: followedId,
    },
    { onConflict: "follower_id,followed_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(error.message || "Falha ao seguir usuario.");
  }
}

export async function unfollowUser({ followerId, followedId }: FollowUserParams): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("chat_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);

  if (error) {
    throw new Error(error.message || "Falha ao deixar de seguir usuario.");
  }
}

export async function fetchFollowedProfiles(followerId: string): Promise<FollowedProfile[]> {
  const supabase = getSupabaseClient();
  const followsResult = await supabase
    .from("chat_follows")
    .select("followed_id")
    .eq("follower_id", followerId);

  if (followsResult.error) {
    throw new Error(followsResult.error.message || "Falha ao buscar seguidos.");
  }

  const followedIds = (followsResult.data ?? []).map((item) => item.followed_id as string);
  if (followedIds.length === 0) return [];

  return (await getChatProfilesByIds(followedIds)) as FollowedProfile[];
}
