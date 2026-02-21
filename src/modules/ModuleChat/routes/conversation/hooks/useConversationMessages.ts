import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../../../../core/stores/sessionStore";
import { makeConversationKey } from "../data/conversationKey";
import { fetchMessages, sendMessage } from "../data/message.repository";
import { subscribeToConversationMessages } from "../data/message.realtime";
import type { Message } from "../types/message";

type UseConversationMessagesResult = {
  messages: Message[];
  loading: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return UUID_PATTERN.test(value);
}

function upsertMessage(list: Message[], next: Message): Message[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index < 0) return [...list, next];
  const copy = [...list];
  copy[index] = next;
  return copy;
}

export function useConversationMessages(otherUserId: string): UseConversationMessagesResult {
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasValidParticipants = useMemo(
    () => isUuid(currentUserId) && isUuid(otherUserId),
    [currentUserId, otherUserId],
  );

  const conversationKey = useMemo(() => {
    if (!currentUserId || !otherUserId) return "";
    if (!hasValidParticipants) return "";
    return makeConversationKey(currentUserId, otherUserId);
  }, [currentUserId, otherUserId, hasValidParticipants]);

  useEffect(() => {
    if (!hasValidParticipants) {
      setMessages([]);
      setLoading(false);
      setError("Conversa invalida: selecione um usuario com ID UUID real.");
      return;
    }

    if (!conversationKey) {
      setMessages([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void fetchMessages({ conversationKey, limit: 50 })
      .then((list) => {
        if (!active) return;
        setMessages(list);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar mensagens.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = subscribeToConversationMessages(conversationKey, {
        onInsert: (incoming) => {
          setMessages((current) => {
            if (current.some((item) => item.id === incoming.id)) return current;
            return [...current, incoming];
          });
        },
        onUpdate: (incoming) => {
          setMessages((current) => upsertMessage(current, incoming));
        },
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Realtime indisponivel para esta conversa.",
      );
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [conversationKey, hasValidParticipants]);

  const send = async (text: string) => {
    if (!currentUserId || !otherUserId || !conversationKey || !hasValidParticipants) {
      setError("Nao foi possivel enviar: conversa com IDs invalidos.");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    const clientId = crypto.randomUUID();
    const optimistic: Message = {
      id: `client:${clientId}`,
      clientId,
      conversationUserId: otherUserId,
      senderId: currentUserId,
      text: trimmed,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((current) => [...current, optimistic]);

    try {
      const saved = await sendMessage({
        conversationKey,
        senderId: currentUserId,
        receiverId: otherUserId,
        text: trimmed,
        clientId,
      });

      setMessages((current) =>
        current.map((item) =>
          item.clientId === clientId ? { ...saved, clientId, status: "sent" } : item,
        ),
      );
    } catch (reason) {
      setMessages((current) =>
        current.map((item) => (item.clientId === clientId ? { ...item, status: "failed" } : item)),
      );
      setError(reason instanceof Error ? reason.message : "Falha ao enviar mensagem.");
    }
  };

  return { messages, loading, error, send };
}
