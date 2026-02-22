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
  if (!params.currentUserId || !params.otherUserId || params.currentUserId === params.otherUserId) {
    throw new Error("DM inválida: usuário de destino igual ao atual.");
  }
  const token = await getAccessToken();
  const supabase = getSupabaseClient();
  const title = makeDmTitle(params.currentUserId, params.otherUserId);
  const [userA, userB] = [params.currentUserId, params.otherUserId].sort();

  const rooms = await cloudChatListRooms(token);
  const existing = rooms.rooms.find((room) => room.title === title);
  if (existing) {
    const upsertExisting = await supabase.from("chat_dm_rooms").upsert(
      {
        room_id: existing.roomId,
        user_a: userA,
        user_b: userB,
      },
      { onConflict: "room_id", ignoreDuplicates: true },
    );
    if (upsertExisting.error) {
      throw new Error(upsertExisting.error.message || "Falha ao sincronizar sala DM.");
    }
    return { roomId: existing.roomId, title };
  }

  const created = await cloudChatCreateRoom(token, {
    title,
    memberIds: [params.otherUserId],
  });
  const upsertCreated = await supabase.from("chat_dm_rooms").upsert(
    {
      room_id: created.roomId,
      user_a: userA,
      user_b: userB,
    },
    { onConflict: "room_id", ignoreDuplicates: true },
  );
  if (upsertCreated.error) {
    throw new Error(upsertCreated.error.message || "Falha ao sincronizar sala DM.");
  }
  return { roomId: created.roomId, title };
}

export async function ensureDMRoomLink(params: {
  roomId: string;
  currentUserId: string;
  otherUserId: string;
}) {
  if (!params.currentUserId || !params.otherUserId || params.currentUserId === params.otherUserId) {
    return;
  }
  const supabase = getSupabaseClient();
  const [userA, userB] = [params.currentUserId, params.otherUserId].sort();
  const upsert = await supabase.from("chat_dm_rooms").upsert(
    {
      room_id: params.roomId,
      user_a: userA,
      user_b: userB,
    },
    { onConflict: "room_id", ignoreDuplicates: true },
  );
  if (upsert.error) {
    throw new Error(upsert.error.message || "Falha ao sincronizar vínculo da sala DM.");
  }
}
