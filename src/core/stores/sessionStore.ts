import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId } from "../modules/types";
import {
  cloudBootstrap,
  cloudPutModules,
  cloudRealtimeWsUrl,
  type CloudUser,
  type ModulesEnabledMap,
} from "../services/cloudflareApi";
import { getSupabaseClient } from "../services/supabase";
import { useLayoutStore } from "../workspace/layoutStore";

type SessionStore = {
  user: CloudUser | null;
  modulesEnabled: Record<ModuleId, boolean>;
  sessionReady: boolean;
  isBootstrapping: boolean;
  isSynced: boolean;
  firstRun: boolean;
  realtimeConnected: boolean;
  lastUsername: string;
  bootstrapSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName: string,
    avatarUrl?: string | null,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setModuleEnabled: (moduleId: ModuleId, enabled: boolean) => void;
  saveModulesEnabledToCloud: () => Promise<void>;
  markWelcomeDone: () => Promise<void>;
};

type RealtimeModulesChanged = {
  type: "modules:changed";
  payload: { modulesEnabled: ModulesEnabledMap };
};

type RealtimeUserUpdated = {
  type: "user:updated";
  payload: {
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
};

let realtimeSocket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
let activeRealtimeToken = "";
const MAX_REALTIME_RECONNECT_ATTEMPTS = 6;

type SessionSet = (
  partial: Partial<SessionStore> | ((state: SessionStore) => Partial<SessionStore>),
) => void;

function clearRealtimeConnection(set: SessionSet) {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  activeRealtimeToken = "";

  const socket = realtimeSocket;
  realtimeSocket = null;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;

    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    } else if (socket.readyState === WebSocket.CONNECTING) {
      socket.onopen = () => {
        socket.close();
      };
    }
  }

  set({ realtimeConnected: false });
}

function validateUsername(raw: string) {
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("Username deve ter 3-20 caracteres [a-z0-9_].");
  }
  return username;
}

function toSyntheticEmail(username: string) {
  return `${username}@example.com`;
}

function baseModulesMap(): Record<ModuleId, boolean> {
  return {
    chat: false,
    feed: false,
    music: false,
    welcome: false,
  };
}

function mergeModulesMap(
  cloudMap: ModulesEnabledMap,
): Record<ModuleId, boolean> {
  return {
    ...baseModulesMap(),
    chat: Boolean(cloudMap.chat),
    feed: Boolean(cloudMap.feed),
    music: Boolean(cloudMap.music),
    welcome: false,
  };
}

function toCloudModulesMap(modulesEnabled: Record<ModuleId, boolean>): ModulesEnabledMap {
  return {
    chat: Boolean(modulesEnabled.chat),
    feed: Boolean(modulesEnabled.feed),
    music: Boolean(modulesEnabled.music),
  };
}

function parseUsernameFromEmail(email: string | null | undefined) {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "";
  return email.slice(0, at).toLowerCase();
}

function isUsernameUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  return (
    text.includes("username_unavailable") ||
    text.includes("duplicate key") ||
    text.includes("unique constraint") ||
    text.includes("username")
  );
}

async function syncFromCloud(
  token: string,
  username?: string,
  displayName?: string,
  avatarUrl?: string | null,
) {
  return cloudBootstrap(token, {
    username,
    displayName,
    avatarUrl: avatarUrl ?? null,
  });
}

function connectRealtime(token: string, set: SessionSet, get: () => SessionStore) {
  clearRealtimeConnection(set);

  activeRealtimeToken = token;

  const openSocket = () => {
    if (!activeRealtimeToken) return;

    const ws = new WebSocket(cloudRealtimeWsUrl(activeRealtimeToken));
    realtimeSocket = ws;

    ws.onopen = () => {
      reconnectAttempts = 0;
      set(() => ({ realtimeConnected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as RealtimeModulesChanged | RealtimeUserUpdated;

        if (parsed.type === "modules:changed") {
          const merged = mergeModulesMap(parsed.payload.modulesEnabled);
          useLayoutStore.getState().applyEnabledModules(merged);
          set(() => ({
            modulesEnabled: merged,
            isSynced: true,
          }));
          return;
        }

        if (parsed.type === "user:updated") {
          const currentUser = get().user;
          const nextUser = parsed.payload?.user;
          if (!currentUser || !nextUser || currentUser.id !== nextUser.id) return;

          set(() => ({
            user: {
              ...currentUser,
              username: nextUser.username,
              display_name: nextUser.display_name,
              avatar_url: nextUser.avatar_url,
            },
            lastUsername: nextUser.username,
          }));
        }
      } catch {
        // ignore malformed payloads
      }
    };

    const scheduleReconnect = () => {
      if (!activeRealtimeToken || get().user === null) return;
      if (reconnectAttempts >= MAX_REALTIME_RECONNECT_ATTEMPTS) {
        set(() => ({ realtimeConnected: false }));
        return;
      }
      set(() => ({ realtimeConnected: false }));
      reconnectAttempts += 1;
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 15000);
      reconnectTimer = window.setTimeout(() => {
        openSocket();
      }, delay);
    };

    ws.onclose = scheduleReconnect;
    ws.onerror = () => {
      ws.close();
    };
  };

  openSocket();
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      user: null,
      modulesEnabled: baseModulesMap(),
      sessionReady: false,
      isBootstrapping: false,
      isSynced: false,
      firstRun: false,
      realtimeConnected: false,
      lastUsername: "",
      bootstrapSession: async () => {
        set({ isBootstrapping: true, isSynced: false });

        try {
          const supabaseClient = getSupabaseClient();
          const { data, error } = await supabaseClient.auth.getSession();
          if (error || !data.session) {
            clearRealtimeConnection(set);
            set({
              user: null,
              sessionReady: true,
              isBootstrapping: false,
              isSynced: false,
              firstRun: false,
            });
            return;
          }

          const token = data.session.access_token;
          const fallbackUsername =
            parseUsernameFromEmail(data.session.user.email) || get().lastUsername;
          const boot = await syncFromCloud(token, fallbackUsername || undefined, undefined, null);
          const mergedModules = mergeModulesMap(boot.modulesEnabled);

          useLayoutStore.getState().applyEnabledModules(mergedModules);
          connectRealtime(token, set, get);

          set({
            user: boot.user,
            modulesEnabled: mergedModules,
            firstRun: boot.firstRun,
            isSynced: true,
            sessionReady: true,
            isBootstrapping: false,
            lastUsername: boot.user.username,
          });
        } catch {
          clearRealtimeConnection(set);
          set({
            user: null,
            sessionReady: true,
            isBootstrapping: false,
            isSynced: false,
            firstRun: false,
          });
        }
      },
      login: async (rawUsername, password) => {
        const supabaseClient = getSupabaseClient();
        const username = validateUsername(rawUsername);
        if (password.length < 6) throw new Error("Senha deve ter no minimo 6 caracteres.");

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: toSyntheticEmail(username),
          password,
        });
        if (error || !data.session) {
          throw new Error("Credenciais invalidas.");
        }

        const boot = await syncFromCloud(data.session.access_token, username, undefined, null);
        const mergedModules = mergeModulesMap(boot.modulesEnabled);
        useLayoutStore.getState().applyEnabledModules(mergedModules);
        connectRealtime(data.session.access_token, set, get);

        set({
          user: boot.user,
          modulesEnabled: mergedModules,
          firstRun: boot.firstRun,
          isSynced: true,
          sessionReady: true,
          isBootstrapping: false,
          lastUsername: username,
        });
      },
      register: async (rawUsername, password, displayName, avatarUrl) => {
        const supabaseClient = getSupabaseClient();
        const username = validateUsername(rawUsername);
        if (password.length < 6) throw new Error("Senha deve ter no minimo 6 caracteres.");

        const signup = await supabaseClient.auth.signUp({
          email: toSyntheticEmail(username),
          password,
        });
        if (signup.error) {
          throw new Error(signup.error.message || "Falha no registro.");
        }

        let token = signup.data.session?.access_token;
        if (!token) {
          const signin = await supabaseClient.auth.signInWithPassword({
            email: toSyntheticEmail(username),
            password,
          });
          if (signin.error || !signin.data.session) {
            throw new Error("Falha ao autenticar apos registro.");
          }
          token = signin.data.session.access_token;
        }

        let boot: Awaited<ReturnType<typeof syncFromCloud>>;
        try {
          boot = await syncFromCloud(token, username, displayName, avatarUrl ?? null);
        } catch (bootstrapError) {
          if (isUsernameUnavailableError(bootstrapError)) {
            throw new Error("username_unavailable");
          }
          throw bootstrapError;
        }
        const mergedModules = mergeModulesMap(boot.modulesEnabled);
        useLayoutStore.getState().applyEnabledModules(mergedModules);
        connectRealtime(token, set, get);

        set({
          user: boot.user,
          modulesEnabled: mergedModules,
          firstRun: true,
          isSynced: true,
          sessionReady: true,
          isBootstrapping: false,
          lastUsername: username,
        });
      },
      logout: async () => {
        const supabaseClient = getSupabaseClient();
        clearRealtimeConnection(set);
        try {
          await supabaseClient.auth.signOut();
        } catch {
          // continue local cleanup even if remote logout fails (ex: 403 in dev)
        }
        useLayoutStore.getState().resetLayout();
        set({
          user: null,
          modulesEnabled: baseModulesMap(),
          firstRun: false,
          isSynced: false,
          sessionReady: true,
          isBootstrapping: false,
        });
      },
      setModuleEnabled: (moduleId, enabled) => {
        set((state) => {
          const next = { ...state.modulesEnabled, [moduleId]: enabled };
          useLayoutStore.getState().applyEnabledModules(next);
          return { modulesEnabled: next, isSynced: false };
        });
      },
      saveModulesEnabledToCloud: async () => {
        const supabaseClient = getSupabaseClient();
        const session = await supabaseClient.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("Sessao invalida.");

        const response = await cloudPutModules(token, toCloudModulesMap(get().modulesEnabled));
        const mergedModules = mergeModulesMap(response.modulesEnabled);
        useLayoutStore.getState().applyEnabledModules(mergedModules);

        set({
          modulesEnabled: mergedModules,
          firstRun: response.firstRun,
          isSynced: true,
        });
      },
      markWelcomeDone: async () => {
        await get().saveModulesEnabledToCloud();
        set((state) => ({
          firstRun: false,
          modulesEnabled: { ...state.modulesEnabled, welcome: false },
        }));
      },
    }),
    {
      name: "gamehub_session_v1",
      partialize: (state) => ({
        modulesEnabled: state.modulesEnabled,
        lastUsername: state.lastUsername,
      }),
      merge: (persisted, current) => {
        const typed = persisted as Partial<SessionStore> | undefined;
        return {
          ...current,
          ...typed,
          user: null,
          sessionReady: false,
          isBootstrapping: false,
          isSynced: false,
          firstRun: false,
          realtimeConnected: false,
        };
      },
    },
  ),
);
