import type { ModuleId } from "../modules/types";

function getApiBaseOrThrow() {
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!value) {
    throw new Error("Config ausente: defina VITE_API_BASE_URL no .env");
  }
  return value;
}

export type CloudUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ModulesEnabledMap = Record<Exclude<ModuleId, "welcome">, boolean>;
export type ChatRoom = {
  roomId: string;
  title: string | null;
  lastMessageAt: string | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type BootstrapResponse = {
  user: CloudUser;
  modulesEnabled: ModulesEnabledMap;
  firstRun: boolean;
};

type BootstrapBody = {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
};

async function apiFetch<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const apiBase = getApiBaseOrThrow();
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function cloudApiFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(path, init, token);
}

export async function cloudBootstrap(
  token: string,
  body: BootstrapBody,
): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>(
    "/bootstrap",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function cloudGetModules(token: string): Promise<{
  modulesEnabled: ModulesEnabledMap;
  firstRun: boolean;
}> {
  return apiFetch(
    "/modules",
    {
      method: "GET",
    },
    token,
  );
}

export async function cloudPutModules(
  token: string,
  modulesEnabled: ModulesEnabledMap,
): Promise<{ modulesEnabled: ModulesEnabledMap; firstRun: boolean }> {
  return apiFetch(
    "/modules",
    {
      method: "PUT",
      body: JSON.stringify({ modulesEnabled }),
    },
    token,
  );
}

export function cloudRealtimeWsUrl(token: string): string {
  const apiBase = getApiBaseOrThrow();
  const baseUrl = new URL(apiBase);
  const wsProtocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.protocol = wsProtocol;
  baseUrl.pathname = "/realtime/ws";
  baseUrl.searchParams.set("token", token);
  return baseUrl.toString();
}

export async function cloudChatCreateRoom(
  token: string,
  payload: { title?: string; memberIds?: string[] },
): Promise<{ roomId: string }> {
  return apiFetch(
    "/chat/rooms",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function cloudChatListRooms(token: string): Promise<{ rooms: ChatRoom[] }> {
  return apiFetch(
    "/chat/rooms",
    {
      method: "GET",
    },
    token,
  );
}

export async function cloudChatGetMessages(
  token: string,
  roomId: string,
  opts?: { limit?: number; before?: string; since?: string },
): Promise<{ messages: ChatMessage[] }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  if (opts?.since) params.set("since", opts.since);
  const query = params.toString();
  const path = `/chat/rooms/${encodeURIComponent(roomId)}/messages${query ? `?${query}` : ""}`;
  return apiFetch(
    path,
    {
      method: "GET",
    },
    token,
  );
}

export async function cloudChatSendMessage(
  token: string,
  roomId: string,
  body: string,
): Promise<{ message: ChatMessage }> {
  return apiFetch(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
    token,
  );
}

export async function cloudChatEditMessage(
  token: string,
  messageId: string,
  body: string,
): Promise<{ messageId: string; body: string; editedAt: string }> {
  return apiFetch(
    `/chat/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ body }),
    },
    token,
  );
}

export async function cloudChatDeleteMessage(
  token: string,
  messageId: string,
): Promise<{ messageId: string; deletedAt: string }> {
  return apiFetch(
    `/chat/messages/${encodeURIComponent(messageId)}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function cloudChatRoomWsUrl(roomId: string, token: string): string {
  const apiBase = getApiBaseOrThrow();
  const baseUrl = new URL(apiBase);
  const wsProtocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.protocol = wsProtocol;
  baseUrl.pathname = `/chat/rooms/${encodeURIComponent(roomId)}/ws`;
  baseUrl.searchParams.set("token", token);
  return baseUrl.toString();
}

export function cloudFeedWsUrl(token: string): string {
  const apiBase = getApiBaseOrThrow();
  const baseUrl = new URL(apiBase);
  const wsProtocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.protocol = wsProtocol;
  baseUrl.pathname = "/feed/ws";
  baseUrl.searchParams.set("token", token);
  return baseUrl.toString();
}
