type MessageEditHistoryEntry = {
  text: string;
  editedAt: string;
};

type MessageEditHistoryState = Record<string, MessageEditHistoryEntry[]>;

const STORAGE_KEY = "chat.messageEditHistory.v1";

function loadState(): MessageEditHistoryState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MessageEditHistoryState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state: MessageEditHistoryState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getMessageEditHistory(messageId: string): MessageEditHistoryEntry[] {
  const state = loadState();
  const list = state[messageId] ?? [];
  return [...list].sort((a, b) => b.editedAt.localeCompare(a.editedAt));
}

export function pushMessageEditHistory(
  messageId: string,
  previousText: string,
  editedAt: string = new Date().toISOString(),
) {
  const nextText = previousText.trim();
  if (!nextText) return;

  const state = loadState();
  const current = state[messageId] ?? [];
  if (current.some((item) => item.text === nextText)) return;

  state[messageId] = [...current, { text: nextText, editedAt }];
  saveState(state);
}

