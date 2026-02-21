import { getSupabaseClient } from "../../../../../core/services/supabase";
import type { Message } from "../types/message";

type DbMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  status: "sent" | "delivered" | "read";
};

type RealtimeHandlers = {
  onInsert: (message: Message) => void;
  onUpdate: (message: Message) => void;
};

function toUiMessage(row: DbMessageRow): Message {
  return {
    id: row.id,
    conversationUserId: row.receiver_id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at,
    status: row.status === "sent" ? "sent" : "sent",
  };
}

export function subscribeToConversationMessages(
  conversationKey: string,
  handlers: RealtimeHandlers,
) {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`chat_messages:${conversationKey}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_key=eq.${conversationKey}`,
      },
      (payload) => handlers.onInsert(toUiMessage(payload.new as DbMessageRow)),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_key=eq.${conversationKey}`,
      },
      (payload) => handlers.onUpdate(toUiMessage(payload.new as DbMessageRow)),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
