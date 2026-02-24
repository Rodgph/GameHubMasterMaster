import { getSupabaseClient } from "../../../core/services/supabase";
import { inferMessageTypeFromFile, uploadToChatMedia } from "./media.repository";
import { getChatProfilesByIds } from "./users.repository";

export type ChatMessageType = "text" | "image" | "audio" | "file";

export type ChatMessageRecord = {
  id: string;
  room_id: string;
  sender_id: string;
  type: ChatMessageType;
  body_text: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_size: number | null;
  audio_duration_ms: number | null;
  reply_to_ids: string[] | null;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_for_all: boolean;
  created_at: string;
};

export type ChatMessageEditRecord = {
  id: string;
  message_id: string;
  room_id: string;
  editor_id: string;
  previous_text: string;
  created_at: string;
};

export type ChatMessageReactionRecord = {
  message_id: string;
  room_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type ChatMessageReactionUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type ChatMessageReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: ChatMessageReactionUser[];
};

function isMissingReactionsTableError(error: { code?: string; message?: string } | null | undefined) {
  const code = (error?.code ?? "").toUpperCase();
  const message = (error?.message ?? "").toLowerCase();
  return code === "PGRST205" || message.includes("could not find the table 'public.chat_message_reactions'");
}

async function requireUserId() {
  const supabase = getSupabaseClient();
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error("Sessão inválida.");
  return userId;
}

export async function listMessages(params: { roomId: string; limit?: number; before?: string }) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const limit = params.limit ?? 30;

  let query = supabase
    .from("chat_messages")
    .select(
      "id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at",
    )
    .eq("room_id", params.roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.before) {
    query = query.lt("created_at", params.before);
  }

  const rows = await query;
  if (rows.error) throw new Error(rows.error.message || "Falha ao listar mensagens.");

  const messages = (rows.data ?? []) as ChatMessageRecord[];
  const messageIds = messages.map((item) => item.id);
  if (messageIds.length === 0) return [];

  const hidden = await supabase
    .from("chat_message_deletes")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (hidden.error) throw new Error(hidden.error.message || "Falha ao filtrar mensagens ocultas.");
  const hiddenIds = new Set((hidden.data ?? []).map((item) => item.message_id as string));

  return messages
    .filter((item) => !hiddenIds.has(item.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function sendTextMessage(params: {
  roomId: string;
  text: string;
  replyToIds?: string[];
  receiverId?: string | null;
}) {
  const supabase = getSupabaseClient();
  const senderId = await requireUserId();
  const text = params.text.trim();
  if (!text) throw new Error("Mensagem vazia.");

  const insert = await supabase
    .from("chat_messages")
    .insert({
      conversation_key: params.roomId,
      room_id: params.roomId,
      sender_id: senderId,
      receiver_id: params.receiverId ?? senderId,
      type: "text",
      text,
      body_text: text,
      status: "sent",
      reply_to_ids: params.replyToIds?.length ? params.replyToIds : null,
    })
    .select(
      "id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at",
    )
    .single();

  if (insert.error || !insert.data) throw new Error(insert.error?.message || "Falha ao enviar mensagem.");
  return insert.data as ChatMessageRecord;
}

export async function sendMediaMessage(params: {
  roomId: string;
  file: File;
  type?: ChatMessageType;
  replyToIds?: string[];
  durationMs?: number;
  receiverId?: string | null;
}) {
  const supabase = getSupabaseClient();
  const senderId = await requireUserId();
  const type = params.type && params.type !== "text" ? params.type : inferMessageTypeFromFile(params.file);
  const uploaded = await uploadToChatMedia(senderId, params.file, params.roomId);

  const insert = await supabase
    .from("chat_messages")
    .insert({
      conversation_key: params.roomId,
      room_id: params.roomId,
      sender_id: senderId,
      receiver_id: params.receiverId ?? senderId,
      type,
      text: params.file.name,
      body_text: params.file.name,
      media_path: uploaded.path,
      media_mime: uploaded.mime,
      media_size: uploaded.size,
      status: "sent",
      audio_duration_ms: type === "audio" ? params.durationMs ?? null : null,
      reply_to_ids: params.replyToIds?.length ? params.replyToIds : null,
    })
    .select(
      "id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at",
    )
    .single();

  if (insert.error || !insert.data) throw new Error(insert.error?.message || "Falha ao enviar mídia.");
  return insert.data as ChatMessageRecord;
}

export async function editMessage(messageId: string, newText: string) {
  const supabase = getSupabaseClient();
  const editorId = await requireUserId();
  const text = newText.trim();
  if (!text) throw new Error("Mensagem vazia.");

  const current = await supabase
    .from("chat_messages")
    .select("id, room_id, body_text, sender_id")
    .eq("id", messageId)
    .single();

  if (current.error || !current.data) throw new Error(current.error?.message || "Mensagem não encontrada.");

  const prevText = (current.data.body_text as string | null) ?? "";
  if (prevText !== text) {
    const insertHistory = await supabase.from("chat_message_edits").insert({
      message_id: messageId,
      room_id: current.data.room_id as string,
      editor_id: editorId,
      previous_text: prevText,
    });
    if (insertHistory.error) throw new Error(insertHistory.error.message || "Falha ao salvar histórico.");
  }

  const updated = await supabase
    .from("chat_messages")
    .update({
      body_text: text,
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select(
      "id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at",
    )
    .single();

  if (updated.error || !updated.data) throw new Error(updated.error?.message || "Falha ao editar mensagem.");
  return updated.data as ChatMessageRecord;
}

export async function getMessageEdits(messageId: string) {
  const supabase = getSupabaseClient();
  const list = await supabase
    .from("chat_message_edits")
    .select("id, message_id, room_id, editor_id, previous_text, created_at")
    .eq("message_id", messageId)
    .order("created_at", { ascending: false });

  if (list.error) throw new Error(list.error.message || "Falha ao listar histórico.");
  return (list.data ?? []) as ChatMessageEditRecord[];
}

export async function deleteForMe(message: Pick<ChatMessageRecord, "id" | "room_id">) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const insert = await supabase.from("chat_message_deletes").upsert(
    {
      user_id: userId,
      message_id: message.id,
      room_id: message.room_id,
    },
    { onConflict: "user_id,message_id" },
  );
  if (insert.error) throw new Error(insert.error.message || "Falha ao ocultar mensagem.");
}

export async function deleteForAll(messageId: string) {
  const supabase = getSupabaseClient();
  const update = await supabase
    .from("chat_messages")
    .update({
      deleted_for_all: true,
      deleted_at: new Date().toISOString(),
      body_text: "[mensagem removida]",
      media_path: null,
      media_mime: null,
      media_size: null,
      audio_duration_ms: null,
    })
    .eq("id", messageId);

  if (update.error) throw new Error(update.error.message || "Falha ao apagar para todos.");
}

export async function toggleFavorite(messageId: string) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const existing = await supabase
    .from("chat_message_favorites")
    .select("message_id")
    .eq("user_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message || "Falha ao consultar favorito.");

  if (existing.data) {
    const remove = await supabase
      .from("chat_message_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("message_id", messageId);
    if (remove.error) throw new Error(remove.error.message || "Falha ao remover favorito.");
    return false;
  }

  const insert = await supabase.from("chat_message_favorites").insert({
    user_id: userId,
    message_id: messageId,
  });
  if (insert.error) throw new Error(insert.error.message || "Falha ao favoritar mensagem.");
  return true;
}

export async function isFavorite(messageId: string) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const row = await supabase
    .from("chat_message_favorites")
    .select("message_id")
    .eq("user_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();
  if (row.error) throw new Error(row.error.message || "Falha ao consultar favorito.");
  return Boolean(row.data);
}

export async function togglePin(roomId: string, messageId: string) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const existing = await supabase
    .from("chat_message_pins")
    .select("message_id")
    .eq("room_id", roomId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message || "Falha ao consultar fixado.");

  if (existing.data) {
    const remove = await supabase
      .from("chat_message_pins")
      .delete()
      .eq("room_id", roomId)
      .eq("message_id", messageId);
    if (remove.error) throw new Error(remove.error.message || "Falha ao desafixar.");
    return false;
  }

  const insert = await supabase.from("chat_message_pins").insert({
    room_id: roomId,
    message_id: messageId,
    pinned_by: userId,
  });
  if (insert.error) throw new Error(insert.error.message || "Falha ao fixar mensagem.");
  return true;
}

export async function isPinned(roomId: string, messageId: string) {
  const supabase = getSupabaseClient();
  const row = await supabase
    .from("chat_message_pins")
    .select("message_id")
    .eq("room_id", roomId)
    .eq("message_id", messageId)
    .maybeSingle();
  if (row.error) throw new Error(row.error.message || "Falha ao consultar fixado.");
  return Boolean(row.data);
}

export async function getFavorites(roomId?: string) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  let query = supabase
    .from("chat_message_favorites")
    .select(
      "created_at, message_id, chat_messages(id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (roomId) {
    query = query.eq("chat_messages.room_id", roomId);
  }

  const rows = await query;
  if (rows.error) throw new Error(rows.error.message || "Falha ao listar favoritos.");

  return (rows.data ?? []).map((item) => ({
    favorited_at: item.created_at as string,
    message: item.chat_messages as unknown as ChatMessageRecord,
  }));
}

export async function getPinned(roomId: string) {
  const supabase = getSupabaseClient();
  const rows = await supabase
    .from("chat_message_pins")
    .select(
      "created_at, message_id, chat_messages(id, room_id, sender_id, type, body_text, media_path, media_mime, media_size, audio_duration_ms, reply_to_ids, edited_at, deleted_at, deleted_for_all, created_at)",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (rows.error) throw new Error(rows.error.message || "Falha ao listar fixadas.");

  return (rows.data ?? []).map((item) => ({
    pinned_at: item.created_at as string,
    message: item.chat_messages as unknown as ChatMessageRecord,
  }));
}

export async function markRoomRead(roomId: string) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const upsert = await supabase.from("chat_room_reads").upsert(
    {
      room_id: roomId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" },
  );
  if (upsert.error) throw new Error(upsert.error.message || "Falha ao marcar leitura.");
}

export async function toggleReaction(params: { messageId: string; roomId: string; emoji: string }) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const emoji = params.emoji.trim();
  if (!emoji) throw new Error("Emoji inválido.");

  const existing = await supabase
    .from("chat_message_reactions")
    .select("message_id")
    .eq("message_id", params.messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing.error) {
    if (isMissingReactionsTableError(existing.error)) return false;
    throw new Error(existing.error.message || "Falha ao consultar reação.");
  }

  if (existing.data) {
    const remove = await supabase
      .from("chat_message_reactions")
      .delete()
      .eq("message_id", params.messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (remove.error) {
      if (isMissingReactionsTableError(remove.error)) return false;
      throw new Error(remove.error.message || "Falha ao remover reação.");
    }
    return false;
  }

  const insert = await supabase.from("chat_message_reactions").insert({
    message_id: params.messageId,
    room_id: params.roomId,
    user_id: userId,
    emoji,
  });
  if (insert.error) {
    if (isMissingReactionsTableError(insert.error)) return false;
    throw new Error(insert.error.message || "Falha ao reagir.");
  }
  return true;
}

export async function listMessageReactions(messageIds: string[]) {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  if (messageIds.length === 0) return {} as Record<string, ChatMessageReactionSummary[]>;

  const rows = await supabase
    .from("chat_message_reactions")
    .select("message_id, room_id, user_id, emoji, created_at")
    .in("message_id", messageIds);

  if (rows.error) {
    if (isMissingReactionsTableError(rows.error)) return {};
    throw new Error(rows.error.message || "Falha ao listar reações.");
  }

  const reactions = (rows.data ?? []) as ChatMessageReactionRecord[];
  const userIds = [...new Set(reactions.map((item) => item.user_id))];

  let profileMap = new Map<string, ChatMessageReactionUser>();
  if (userIds.length > 0) {
    const profiles = await getChatProfilesByIds(userIds);
    profileMap = new Map(
      (profiles as ChatMessageReactionUser[]).map((item) => [
        item.id,
        { id: item.id, username: item.username, avatar_url: item.avatar_url ?? null },
      ]),
    );
  }

  const grouped = new Map<string, Map<string, ChatMessageReactionSummary>>();
  for (const item of reactions) {
    const byMessage = grouped.get(item.message_id) ?? new Map<string, ChatMessageReactionSummary>();
    const existing = byMessage.get(item.emoji);
    const profile = profileMap.get(item.user_id) ?? {
      id: item.user_id,
      username: "usuario",
      avatar_url: null,
    };
    if (existing) {
      existing.count += 1;
      existing.reactedByMe = existing.reactedByMe || item.user_id === userId;
      existing.users.push(profile);
    } else {
      byMessage.set(item.emoji, {
        emoji: item.emoji,
        count: 1,
        reactedByMe: item.user_id === userId,
        users: [profile],
      });
    }
    grouped.set(item.message_id, byMessage);
  }

  const result: Record<string, ChatMessageReactionSummary[]> = {};
  for (const messageId of messageIds) {
    const items = [...(grouped.get(messageId)?.values() ?? [])].sort((a, b) => b.count - a.count);
    result[messageId] = items;
  }
  return result;
}



