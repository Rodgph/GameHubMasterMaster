export type OpenConversation = {
  userId: string;
  type?: "dm" | "group";
  roomId?: string;
  username: string;
  avatarUrl?: string;
  lastOpenedAt: string;
  pinned?: boolean;
  muted?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string;
};

const STORAGE_KEY = "chat_open_conversations";

function normalizeConversation(item: OpenConversation): OpenConversation {
  return {
    ...item,
    type: item.type === "group" ? "group" : "dm",
    roomId: typeof item.roomId === "string" ? item.roomId : undefined,
    pinned: Boolean(item.pinned),
    muted: Boolean(item.muted),
    unreadCount: Number.isFinite(item.unreadCount) ? Math.max(0, Number(item.unreadCount)) : 0,
    lastMessagePreview: item.lastMessagePreview ?? "",
  };
}

function saveOpenConversations(items: OpenConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getOpenConversations(): OpenConversation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OpenConversation[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) => item && typeof item.userId === "string" && typeof item.username === "string",
      )
      .map(normalizeConversation)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  } catch {
    return [];
  }
}

export function addOpenConversation(conversation: OpenConversation): OpenConversation[] {
  if (typeof window === "undefined") return [];
  const current = getOpenConversations();
  const existing = current.find((item) => item.userId === conversation.userId);
  const merged = normalizeConversation({
    ...existing,
    ...conversation,
    lastOpenedAt: conversation.lastOpenedAt,
  });
  const deduped = current.filter((item) => item.userId !== conversation.userId);
  const normalized = [merged, ...deduped].map(normalizeConversation);
  saveOpenConversations(normalized);
  return normalized;
}

export function removeOpenConversation(userId: string): OpenConversation[] {
  if (typeof window === "undefined") return [];
  const next = getOpenConversations().filter((item) => item.userId !== userId);
  saveOpenConversations(next);
  return next;
}

export function markUnread(userId: string, count = 1): OpenConversation[] {
  const next = getOpenConversations().map((item) =>
    item.userId === userId
      ? { ...item, unreadCount: Math.max(1, count), lastOpenedAt: new Date().toISOString() }
      : item,
  );
  saveOpenConversations(next);
  return next;
}

export function markRead(userId: string): OpenConversation[] {
  const next = getOpenConversations().map((item) =>
    item.userId === userId
      ? { ...item, unreadCount: 0, lastOpenedAt: new Date().toISOString() }
      : item,
  );
  saveOpenConversations(next);
  return next;
}

export function togglePinned(userId: string): OpenConversation[] {
  const next = getOpenConversations().map((item) =>
    item.userId === userId ? { ...item, pinned: !item.pinned } : item,
  );
  saveOpenConversations(next);
  return next;
}

export function toggleMuted(userId: string): OpenConversation[] {
  const next = getOpenConversations().map((item) =>
    item.userId === userId ? { ...item, muted: !item.muted } : item,
  );
  saveOpenConversations(next);
  return next;
}

export function clearOpenConversations(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
