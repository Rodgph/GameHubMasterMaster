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
  limit?: number;
};

type SendMessageParams = {
  conversationKey: string;
  senderId: string;
  receiverId: string;
  text: string;
  clientId?: string;
};

function toUiMessage(row: DbMessageRow): Message {
  return {
    id: row.id,
    clientId: undefined,
    conversationUserId: row.receiver_id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at,
    status: row.status === "sent" ? "sent" : "sent",
  };
}

export async function fetchMessages({
  conversationKey,
  limit = 50,
}: FetchMessagesParams): Promise<Message[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, conversation_key, sender_id, receiver_id, text, created_at, status")
    .eq("conversation_key", conversationKey)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => toUiMessage(row as DbMessageRow));
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
  return toUiMessage(data as DbMessageRow);
}
