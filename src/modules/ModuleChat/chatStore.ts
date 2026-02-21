import { create } from "zustand";
import {
  cloudChatCreateRoom,
  cloudChatDeleteMessage,
  cloudChatEditMessage,
  cloudChatGetMessages,
  cloudChatListRooms,
  cloudChatRoomWsUrl,
  cloudChatSendMessage,
  type ChatMessage,
  type ChatRoom,
} from "../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../core/services/supabase";

type WsStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

type ChatStore = {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  messagesByRoomId: Record<string, ChatMessage[]>;
  wsStatus: WsStatus;
  loadingRooms: boolean;
  loadingMessages: boolean;
  error: string | null;
  loadRooms: () => Promise<void>;
  createRoom: (title?: string) => Promise<void>;
  openRoom: (roomId: string) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
};

let roomSocket: WebSocket | null = null;
let activeRoomSocketId: string | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 6;

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map<string, ChatMessage>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function updateMessageInList(
  list: ChatMessage[],
  id: string,
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  return list.map((message) => (message.id === id ? { ...message, ...patch } : message));
}

function clearSocket() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  activeRoomSocketId = null;

  if (roomSocket) {
    roomSocket.onclose = null;
    roomSocket.onerror = null;
    roomSocket.onmessage = null;
    roomSocket.close();
    roomSocket = null;
  }
}

async function loadMissedMessages(roomId: string, set: (patch: Partial<ChatStore>) => void) {
  const token = await getAccessToken();
  const state = useChatStore.getState();
  const current = state.messagesByRoomId[roomId] ?? [];
  const since = current.length > 0 ? current[current.length - 1].createdAt : undefined;
  const response = await cloudChatGetMessages(token, roomId, { limit: 50, since });
  const nextList = mergeMessages(current, response.messages);
  set({ messagesByRoomId: { ...state.messagesByRoomId, [roomId]: nextList } });
}

function connectRoomWs(roomId: string, set: (patch: Partial<ChatStore>) => void) {
  clearSocket();
  activeRoomSocketId = roomId;
  set({ wsStatus: "connecting" });

  const open = async () => {
    let token = "";
    try {
      token = await getAccessToken();
    } catch {
      set({ wsStatus: "error", error: "Sessao invalida." });
      return;
    }

    const ws = new WebSocket(cloudChatRoomWsUrl(roomId, token));
    roomSocket = ws;

    ws.onopen = async () => {
      reconnectAttempts = 0;
      set({ wsStatus: "connected" });
      await loadMissedMessages(roomId, set);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as
          | { type: "chat:message_new"; payload: { message: ChatMessage } }
          | {
              type: "chat:message_edit";
              payload: { messageId: string; body: string; editedAt: string };
            }
          | { type: "chat:message_delete"; payload: { messageId: string; deletedAt: string } };

        const state = useChatStore.getState();
        const current = state.messagesByRoomId[roomId] ?? [];

        if (parsed.type === "chat:message_new") {
          const next = mergeMessages(current, [parsed.payload.message]);
          set({ messagesByRoomId: { ...state.messagesByRoomId, [roomId]: next } });
          return;
        }

        if (parsed.type === "chat:message_edit") {
          const next = updateMessageInList(current, parsed.payload.messageId, {
            body: parsed.payload.body,
            editedAt: parsed.payload.editedAt,
          });
          set({ messagesByRoomId: { ...state.messagesByRoomId, [roomId]: next } });
          return;
        }

        if (parsed.type === "chat:message_delete") {
          const next = updateMessageInList(current, parsed.payload.messageId, {
            deletedAt: parsed.payload.deletedAt,
            body: "[mensagem removida]",
          });
          set({ messagesByRoomId: { ...state.messagesByRoomId, [roomId]: next } });
        }
      } catch {
        // ignore malformed event
      }
    };

    ws.onclose = () => {
      if (activeRoomSocketId !== roomId) return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        set({ wsStatus: "error", error: "Falha ao reconectar no chat da sala." });
        return;
      }
      reconnectAttempts += 1;
      set({ wsStatus: "reconnecting" });
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 10000);
      reconnectTimer = window.setTimeout(() => {
        void open();
      }, delay);
    };

    ws.onerror = () => {
      set({ wsStatus: "error" });
      ws.close();
    };
  };

  void open();
}

export const useChatStore = create<ChatStore>((set, get) => ({
  rooms: [],
  activeRoomId: null,
  messagesByRoomId: {},
  wsStatus: "idle",
  loadingRooms: false,
  loadingMessages: false,
  error: null,
  loadRooms: async () => {
    set({ loadingRooms: true, error: null });
    try {
      const token = await getAccessToken();
      const response = await cloudChatListRooms(token);
      set({ rooms: response.rooms, loadingRooms: false });
    } catch (error) {
      set({
        loadingRooms: false,
        error: error instanceof Error ? error.message : "Falha ao carregar salas.",
      });
    }
  },
  createRoom: async (title) => {
    try {
      const token = await getAccessToken();
      await cloudChatCreateRoom(token, { title });
      await get().loadRooms();
      const latest = useChatStore.getState().rooms[0];
      if (latest) {
        await get().openRoom(latest.roomId);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Falha ao criar sala." });
    }
  },
  openRoom: async (roomId) => {
    set({ activeRoomId: roomId, loadingMessages: true, error: null });
    try {
      const token = await getAccessToken();
      const response = await cloudChatGetMessages(token, roomId, { limit: 50 });
      set((state) => ({
        messagesByRoomId: {
          ...state.messagesByRoomId,
          [roomId]: mergeMessages([], response.messages),
        },
        loadingMessages: false,
      }));
      connectRoomWs(roomId, set);
    } catch (error) {
      set({
        loadingMessages: false,
        error: error instanceof Error ? error.message : "Falha ao abrir sala.",
      });
    }
  },
  sendMessage: async (body) => {
    const roomId = get().activeRoomId;
    if (!roomId) return;

    const text = body.trim();
    if (!text) return;

    try {
      const token = await getAccessToken();
      await cloudChatSendMessage(token, roomId, text);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Falha ao enviar mensagem." });
    }
  },
  editMessage: async (messageId, body) => {
    const text = body.trim();
    if (!text) return;
    try {
      const token = await getAccessToken();
      await cloudChatEditMessage(token, messageId, text);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Falha ao editar mensagem." });
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const token = await getAccessToken();
      await cloudChatDeleteMessage(token, messageId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Falha ao remover mensagem." });
    }
  },
}));
