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
