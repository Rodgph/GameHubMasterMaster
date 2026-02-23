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
const REMOVED_STORAGE_KEY = "chat_removed_conversations";

type RemovedConversation = {
  userId: string;
  roomId?: string;
  removedAt: string;
};

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

function normalizeRemovedConversation(item: RemovedConversation): RemovedConversation {
  return {
    userId: item.userId,
    roomId: typeof item.roomId === "string" ? item.roomId : undefined,
    removedAt: item.removedAt,
  };
}

function saveOpenConversations(items: OpenConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function saveRemovedConversations(items: RemovedConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify(items));
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

function getRemovedConversations(): RemovedConversation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(REMOVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RemovedConversation[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.userId === "string" && typeof item.removedAt === "string")
      .map(normalizeRemovedConversation)
      .sort((a, b) => b.removedAt.localeCompare(a.removedAt));
  } catch {
    return [];
  }
}

function clearRemovedConversation(params: { userId?: string; roomId?: string }) {
  const { userId, roomId } = params;
  if (!userId && !roomId) return;
  const next = getRemovedConversations().filter((item) => {
    if (roomId && item.roomId === roomId) return false;
    if (userId && item.userId === userId) return false;
    return true;
  });
  saveRemovedConversations(next);
}

function markConversationRemoved(params: { userId: string; roomId?: string; removedAt?: string }) {
  const { userId, roomId } = params;
  const removedAt = params.removedAt ?? new Date().toISOString();
  const current = getRemovedConversations();
  const nextItem = normalizeRemovedConversation({ userId, roomId, removedAt });
  const next = [
    nextItem,
    ...current.filter((item) => item.userId !== userId && (!roomId || item.roomId !== roomId)),
  ];
  saveRemovedConversations(next);
}

export function shouldKeepConversationRemoved(params: {
  userId: string;
  roomId?: string;
  lastMessageAt?: string | null;
}): boolean {
  const { userId, roomId, lastMessageAt } = params;
  const removed = getRemovedConversations().find(
    (item) => item.userId === userId || (roomId ? item.roomId === roomId : false),
  );
  if (!removed) return false;

  if (lastMessageAt && lastMessageAt > removed.removedAt) {
    clearRemovedConversation({ userId, roomId });
    return false;
  }

  return true;
}

export function addOpenConversation(conversation: OpenConversation): OpenConversation[] {
  if (typeof window === "undefined") return [];
  clearRemovedConversation({ userId: conversation.userId, roomId: conversation.roomId });
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

export function removeOpenConversation(userId: string, roomId?: string): OpenConversation[] {
  if (typeof window === "undefined") return [];
  const next = getOpenConversations().filter((item) => item.userId !== userId);
  saveOpenConversations(next);
  markConversationRemoved({ userId, roomId });
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
  window.localStorage.removeItem(REMOVED_STORAGE_KEY);
}
