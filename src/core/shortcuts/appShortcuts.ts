type ShortcutEventLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

type AppShortcut = {
  key: string;
  requireCtrlOrMeta?: boolean;
  requireShift?: boolean;
  requireAlt?: boolean;
};

function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function toBool(value: boolean | undefined) {
  return Boolean(value);
}

export const APP_SHORTCUTS = {
  TOGGLE_GLOBAL_SEARCH: {
    key: "f",
    requireCtrlOrMeta: true,
  },
  CLOSE_OVERLAY: {
    key: "Escape",
  },
  CONFIRM_WITH_ENTER: {
    key: "Enter",
  },
} satisfies Record<string, AppShortcut>;

export function isShortcutPressed(event: ShortcutEventLike, shortcut: AppShortcut): boolean {
  if (normalizeKey(event.key) !== normalizeKey(shortcut.key)) {
    return false;
  }

  if (shortcut.requireCtrlOrMeta && !(toBool(event.ctrlKey) || toBool(event.metaKey))) {
    return false;
  }

  if (shortcut.requireShift && !toBool(event.shiftKey)) {
    return false;
  }

  if (shortcut.requireAlt && !toBool(event.altKey)) {
    return false;
  }

  return true;
}
