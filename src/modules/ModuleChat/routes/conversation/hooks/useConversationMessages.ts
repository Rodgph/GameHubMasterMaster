import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getLastSync,
  getMessagesByConversation,
  listOutbox,
  markMessageFailed,
  putPendingMessage,
  setLastSync,
  updateMessageDelivery,
  upsertMessages,
} from "../../../../../infra/localdb/chatRepo";
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
  const index = list.findIndex(
    (item) =>
      (item.clientId && next.clientId && item.clientId === next.clientId) || item.id === next.id,
  );
  if (index < 0) return [...list, next];
  const copy = [...list];
  copy[index] = { ...copy[index], ...next };
  return copy;
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const item of [...current, ...incoming]) {
    const key = item.clientId ? `c:${item.clientId}` : `i:${item.id}`;
    const previous = map.get(key);
    map.set(key, previous ? { ...previous, ...item } : item);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function toTimestamp(value: string): number {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Date.now();
}

function cachedToMessage(
  item: {
    id: string;
    clientId: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: number;
    status: "sending" | "sent" | "failed";
  },
  currentUserId: string,
): Message {
  const [left, right] = item.conversationId.split("__");
  const conversationUserId = left === currentUserId ? (right ?? "") : (left ?? "");
  return {
    id: item.id,
    clientId: item.clientId,
    conversationUserId,
    senderId: item.senderId,
    text: item.body,
    createdAt: new Date(item.createdAt).toISOString(),
    status: item.status,
  };
}

export function useConversationMessages(otherUserId: string): UseConversationMessagesResult {
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFlushingRef = useRef(false);
  const hasValidParticipants = useMemo(
    () => isUuid(currentUserId) && isUuid(otherUserId),
    [currentUserId, otherUserId],
  );

  const conversationKey = useMemo(() => {
    if (!currentUserId || !otherUserId) return "";
    if (!hasValidParticipants) return "";
    return makeConversationKey(currentUserId, otherUserId);
  }, [currentUserId, otherUserId, hasValidParticipants]);

  const syncFromServer = useCallback(async () => {
    if (!currentUserId || !conversationKey) return;
    const lastSync = await getLastSync(conversationKey);
    const since = lastSync ? new Date(lastSync).toISOString() : undefined;
    const remote = await fetchMessages({
      conversationKey,
      currentUserId,
      limit: 100,
      since,
    });
    if (remote.length === 0) return;

    await upsertMessages(
      remote.map((item) => ({
        id: item.id,
        clientId: item.clientId ?? item.id,
        conversationId: conversationKey,
        senderId: item.senderId,
        body: item.text,
        createdAt: toTimestamp(item.createdAt),
        status: item.status ?? "sent",
      })),
    );

    const latest = Math.max(...remote.map((item) => toTimestamp(item.createdAt)));
    await setLastSync(conversationKey, latest);
    setMessages((current) => mergeMessages(current, remote));
  }, [conversationKey, currentUserId]);

  const flushOutbox = useCallback(async () => {
    if (!currentUserId || !conversationKey || !navigator.onLine || isFlushingRef.current) return;
    isFlushingRef.current = true;

    try {
      const pending = await listOutbox(conversationKey);
      for (const item of pending) {
        try {
          const saved = await sendMessage({
            conversationKey: item.payload.conversationId,
            senderId: item.payload.senderId,
            receiverId: item.payload.receiverId,
            text: item.payload.text,
            clientId: item.clientId,
          });

          await updateMessageDelivery(item.clientId, {
            id: saved.id,
            conversationId: conversationKey,
            senderId: saved.senderId,
            body: saved.text,
            createdAt: toTimestamp(saved.createdAt),
            status: "sent",
          });
          await setLastSync(conversationKey, toTimestamp(saved.createdAt));

          setMessages((current) =>
            current.map((msg) =>
              msg.clientId === item.clientId
                ? { ...saved, clientId: item.clientId, status: "sent" }
                : msg,
            ),
          );
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "Falha ao reenviar mensagem.";
          await markMessageFailed(item.clientId, message);
          setMessages((current) =>
            current.map((msg) => (msg.clientId === item.clientId ? { ...msg, status: "failed" } : msg)),
          );
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [conversationKey, currentUserId]);

  useEffect(() => {
    if (!hasValidParticipants) {
      setMessages([]);
      setLoading(false);
      setError("Conversa invalida: selecione um usuario com ID UUID real.");
      return;
    }

    if (!conversationKey || !currentUserId) {
      setMessages([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void getMessagesByConversation(conversationKey)
      .then((cached) => {
        if (!active) return;
        const mapped = cached.map((item) => cachedToMessage(item, currentUserId));
        setMessages(mapped);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Falha ao ler cache local.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    void syncFromServer().catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Falha ao sincronizar mensagens.");
    });

    void flushOutbox();

    const handleOnline = () => {
      void flushOutbox().then(() => syncFromServer()).catch(() => undefined);
    };
    window.addEventListener("online", handleOnline);

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = subscribeToConversationMessages(conversationKey, currentUserId, {
        onInsert: (incoming) => {
          const normalized = { ...incoming, status: incoming.status ?? "sent" };
          void upsertMessages([
            {
              id: normalized.id,
              clientId: normalized.clientId ?? normalized.id,
              conversationId: conversationKey,
              senderId: normalized.senderId,
              body: normalized.text,
              createdAt: toTimestamp(normalized.createdAt),
              status: normalized.status,
            },
          ]);
          void setLastSync(conversationKey, toTimestamp(normalized.createdAt));
          setMessages((current) => mergeMessages(current, [normalized]));
        },
        onUpdate: (incoming) => {
          const normalized = { ...incoming, status: incoming.status ?? "sent" };
          void upsertMessages([
            {
              id: normalized.id,
              clientId: normalized.clientId ?? normalized.id,
              conversationId: conversationKey,
              senderId: normalized.senderId,
              body: normalized.text,
              createdAt: toTimestamp(normalized.createdAt),
              status: normalized.status,
            },
          ]);
          void setLastSync(conversationKey, toTimestamp(normalized.createdAt));
          setMessages((current) => upsertMessage(current, normalized));
        },
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Realtime indisponivel para esta conversa.",
      );
    }

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      unsubscribe?.();
    };
  }, [conversationKey, currentUserId, flushOutbox, hasValidParticipants, syncFromServer]);

  const send = async (text: string) => {
    if (!currentUserId || !otherUserId || !conversationKey || !hasValidParticipants) {
      setError("Nao foi possivel enviar: conversa com IDs invalidos.");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    const clientId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: Message = {
      id: `client:${clientId}`,
      clientId,
      conversationUserId: otherUserId,
      senderId: currentUserId,
      text: trimmed,
      createdAt,
      status: "sending",
    };

    setMessages((current) => mergeMessages(current, [optimistic]));
    await putPendingMessage(
      {
        id: optimistic.id,
        clientId,
        conversationId: conversationKey,
        senderId: currentUserId,
        body: trimmed,
        createdAt: toTimestamp(createdAt),
        status: "sending",
      },
      {
        conversationId: conversationKey,
        senderId: currentUserId,
        receiverId: otherUserId,
        text: trimmed,
      },
    );

    if (!navigator.onLine) return;

    try {
      const saved = await sendMessage({
        conversationKey,
        senderId: currentUserId,
        receiverId: otherUserId,
        text: trimmed,
        clientId,
      });

      await updateMessageDelivery(clientId, {
        id: saved.id,
        conversationId: conversationKey,
        senderId: saved.senderId,
        body: saved.text,
        createdAt: toTimestamp(saved.createdAt),
        status: "sent",
      });
      await setLastSync(conversationKey, toTimestamp(saved.createdAt));

      setMessages((current) =>
        current.map((item) =>
          item.clientId === clientId ? { ...saved, clientId, status: "sent" } : item,
        ),
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Falha ao enviar mensagem.";
      await markMessageFailed(clientId, message);
      setMessages((current) =>
        current.map((item) => (item.clientId === clientId ? { ...item, status: "failed" } : item)),
      );
      setError(message);
    }
  };

  return { messages, loading, error, send };
}
