type StoredFavoriteMessage = {
  id: string;
  roomId: string;
  text: string;
  createdAt: string;
  senderId: string;
  favoritedAt: string;
};

type MessagePreferencesState = {
  hiddenByRoom: Record<string, string[]>;
  pinnedByRoom: Record<string, string[]>;
  favorites: StoredFavoriteMessage[];
};

const STORAGE_KEY = "chat_message_preferences_v1";

function emptyState(): MessagePreferencesState {
  return {
    hiddenByRoom: {},
    pinnedByRoom: {},
    favorites: [],
  };
}

function loadState(): MessagePreferencesState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as MessagePreferencesState;
    return {
      hiddenByRoom: parsed.hiddenByRoom ?? {},
      pinnedByRoom: parsed.pinnedByRoom ?? {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return emptyState();
  }
}

function saveState(next: MessagePreferencesState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function hideMessageForMe(roomId: string, messageId: string) {
  const state = loadState();
  const current = new Set(state.hiddenByRoom[roomId] ?? []);
  current.add(messageId);
  const next = {
    ...state,
    hiddenByRoom: {
      ...state.hiddenByRoom,
      [roomId]: [...current],
    },
  };
  saveState(next);
}

export function getHiddenMessageIds(roomId: string) {
  const state = loadState();
  return new Set(state.hiddenByRoom[roomId] ?? []);
}

export function togglePinnedMessage(roomId: string, messageId: string) {
  const state = loadState();
  const current = new Set(state.pinnedByRoom[roomId] ?? []);
  if (current.has(messageId)) {
    current.delete(messageId);
  } else {
    current.add(messageId);
  }
  const next = {
    ...state,
    pinnedByRoom: {
      ...state.pinnedByRoom,
      [roomId]: [...current],
    },
  };
  saveState(next);
}

export function isPinnedMessage(roomId: string, messageId: string) {
  const state = loadState();
  return (state.pinnedByRoom[roomId] ?? []).includes(messageId);
}

export function toggleFavoriteMessage(message: StoredFavoriteMessage) {
  const state = loadState();
  const exists = state.favorites.some((item) => item.id === message.id);
  const nextFavorites = exists
    ? state.favorites.filter((item) => item.id !== message.id)
    : [{ ...message, favoritedAt: new Date().toISOString() }, ...state.favorites];
  saveState({ ...state, favorites: nextFavorites });
}

export function isFavoriteMessage(messageId: string) {
  const state = loadState();
  return state.favorites.some((item) => item.id === messageId);
}

export function getFavoriteMessages() {
  return loadState().favorites.sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt));
}
