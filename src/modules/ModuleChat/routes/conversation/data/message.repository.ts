import { getSupabaseClient } from "../../../../../core/services/supabase";
import type { Message } from "../types/message";

type DbMessageRow = {
  id: string;
  conversation_key: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  status: "sent" | "delivered" | "read";
};

type FetchMessagesParams = {
  conversationKey: string;
  currentUserId: string;
  limit?: number;
  since?: string;
};

type SendMessageParams = {
  conversationKey: string;
  senderId: string;
  receiverId: string;
  text: string;
  clientId?: string;
};

function toUiMessage(row: DbMessageRow, currentUserId: string): Message {
  const conversationUserId = row.sender_id === currentUserId ? row.receiver_id : row.sender_id;
  return {
    id: row.id,
    clientId: undefined,
    conversationUserId,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at,
    status: row.status === "sent" ? "sent" : "sent",
  };
}

export async function fetchMessages({
  conversationKey,
  currentUserId,
  limit = 50,
  since,
}: FetchMessagesParams): Promise<Message[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("chat_messages")
    .select("id, conversation_key, sender_id, receiver_id, text, created_at, status")
    .eq("conversation_key", conversationKey)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (since) {
    query = query.gt("created_at", since);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map((row) => toUiMessage(row as DbMessageRow, currentUserId));
}

export async function sendMessage({
  conversationKey,
  senderId,
  receiverId,
  text,
  clientId,
}: SendMessageParams): Promise<Message> {
  void clientId;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_key: conversationKey,
      sender_id: senderId,
      receiver_id: receiverId,
      text,
      status: "sent",
    })
    .select("id, conversation_key, sender_id, receiver_id, text, created_at, status")
    .single();

  if (error) throw error;
  return toUiMessage(data as DbMessageRow, senderId);
}
