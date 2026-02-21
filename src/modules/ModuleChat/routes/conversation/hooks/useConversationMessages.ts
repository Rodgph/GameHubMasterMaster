import { useMemo, useState } from "react";
import type { Message } from "../types/message";

function createMockMessages(conversationUserId: string): Message[] {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, index) => {
    const outgoing = index % 2 === 0;
    return {
      id: `mock_${conversationUserId}_${index}`,
      conversationUserId,
      senderId: outgoing ? "me" : "other",
      text: outgoing ? "Fechado. Vou subir isso agora." : "Boa, me manda quando terminar.",
      createdAt: new Date(now - (12 - index) * 60000).toISOString(),
      status: "sent",
    };
  });
}

export function useConversationMessages(userId: string) {
  const [messages, setMessages] = useState<Message[]>(() => createMockMessages(userId));

  const sendLocal = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const clientId = `client_${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: clientId,
      clientId,
      conversationUserId: userId,
      senderId: "me",
      text: trimmed,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((current) => [...current, optimisticMessage]);

    const confirmDelay = 300 + Math.floor(Math.random() * 300);
    window.setTimeout(() => {
      setMessages((current) =>
        current.map((message) =>
          message.clientId === clientId
            ? { ...message, id: `msg_${crypto.randomUUID()}`, status: "sent" }
            : message,
        ),
      );
    }, confirmDelay);
  };

  const stableMessages = useMemo(() => messages, [messages]);
  return { messages: stableMessages, sendLocal };
}
