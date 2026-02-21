export type OpenConversation = {
  userId: string;
  username: string;
  avatarUrl?: string;
  lastOpenedAt: string;
};

const STORAGE_KEY = "chat_open_conversations";

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
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  } catch {
    return [];
  }
}

export function addOpenConversation(conversation: OpenConversation): void {
  if (typeof window === "undefined") return;
  const current = getOpenConversations();
  const deduped = current.filter((item) => item.userId !== conversation.userId);
  const next = [conversation, ...deduped].sort((a, b) =>
    b.lastOpenedAt.localeCompare(a.lastOpenedAt),
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removeOpenConversation(userId: string): void {
  if (typeof window === "undefined") return;
  const next = getOpenConversations().filter((item) => item.userId !== userId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearOpenConversations(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
