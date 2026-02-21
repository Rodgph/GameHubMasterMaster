import { cloudChatCreateRoom, cloudChatListRooms } from "../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../core/services/supabase";

function makeDmTitle(currentUserId: string, otherUserId: string) {
  const [a, b] = [currentUserId, otherUserId].sort();
  return `dm:${a}:${b}`;
}

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

export async function getOrCreateDMRoom(params: { currentUserId: string; otherUserId: string }) {
  const token = await getAccessToken();
  const title = makeDmTitle(params.currentUserId, params.otherUserId);

  const rooms = await cloudChatListRooms(token);
  const existing = rooms.rooms.find((room) => room.title === title);
  if (existing) return { roomId: existing.roomId, title };

  const created = await cloudChatCreateRoom(token, {
    title,
    memberIds: [params.otherUserId],
  });
  return { roomId: created.roomId, title };
}
