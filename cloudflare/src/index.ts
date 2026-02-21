import { createRemoteJWKSet, jwtVerify } from "jose";
import { FeedDO } from "./do/FeedDO";
import { RoomDO } from "./do/RoomDO";
import { RealtimeDO } from "./realtime";
import { handleChatRoutes } from "./routes/chat";
import { handleFeedRoutes } from "./routes/feed";

type Env = {
  DB: D1Database;
  REALTIME: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
  FEED: DurableObjectNamespace;
  SUPABASE_PROJECT_URL: string;
  SUPABASE_JWT_ISS: string;
  SUPABASE_JWT_AUD: string;
};

type VerifiedUser = {
  userId: string;
};

type BootstrapBody = {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
};

const MODULE_IDS = ["chat", "feed", "music"] as const;
type ModuleId = (typeof MODULE_IDS)[number];

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

function json(data: unknown, request: Request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request),
    },
  });
}

function sanitizeUsername(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    throw new Error("invalid_username");
  }
  return normalized;
}

function makeFallbackUsername(base: string, userId: string) {
  const suffix = userId.replace(/-/g, "").slice(0, 6).toLowerCase();
  const safeBase = base.replace(/[^a-z0-9_]/g, "").slice(0, 13).toLowerCase() || "user";
  return `${safeBase}_${suffix}`;
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  return null;
}

function getJwks(env: Env) {
  const key = env.SUPABASE_PROJECT_URL;
  const cached = jwksCache.get(key);
  if (cached) return cached;

  const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_PROJECT_URL);
  const jwks = createRemoteJWKSet(jwksUrl);
  jwksCache.set(key, jwks);
  return jwks;
}

async function verifyUser(request: Request, env: Env): Promise<VerifiedUser> {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("missing_token");
  }

  const jwks = getJwks(env);
  const verified = await jwtVerify(token, jwks, {
    issuer: env.SUPABASE_JWT_ISS,
    audience: env.SUPABASE_JWT_AUD,
  });

  const userId = verified.payload.sub;
  if (!userId || typeof userId !== "string") {
    throw new Error("invalid_sub");
  }

  return { userId };
}

async function getModulesEnabled(env: Env, userId: string) {
  const rows = await env.DB.prepare(
    "SELECT module_id, enabled FROM user_modules WHERE user_id = ? ORDER BY sort_order ASC",
  )
    .bind(userId)
    .all<{ module_id: string; enabled: number }>();

  const modulesEnabled: Record<ModuleId, boolean> = {
    chat: false,
    feed: false,
    music: false,
  };

  for (const row of rows.results ?? []) {
    if (row.module_id === "chat" || row.module_id === "feed" || row.module_id === "music") {
      modulesEnabled[row.module_id] = Boolean(row.enabled);
    }
  }

  return {
    modulesEnabled,
    firstRun: (rows.results?.length ?? 0) === 0,
  };
}

async function handleBootstrap(request: Request, env: Env, userId: string) {
  const body = (await request.json().catch(() => ({}))) as BootstrapBody;
  const username = body.username ? sanitizeUsername(body.username) : null;
  const displayName = body.displayName?.trim() || null;
  const avatarUrl = body.avatarUrl?.trim() || null;

  const existing = await env.DB.prepare(
    "SELECT id, username, display_name, avatar_url FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }>();

  if (!existing) {
    const desiredUsername = username ?? makeFallbackUsername("user", userId);
    let inserted = false;

    try {
      await env.DB.prepare(
        "INSERT INTO users (id, username, display_name, avatar_url) VALUES (?, ?, ?, ?)",
      )
        .bind(userId, desiredUsername, displayName ?? desiredUsername, avatarUrl)
        .run();
      inserted = true;
    } catch {
      // username conflict: fallback to deterministic username to avoid bootstrap deadlock
      const fallbackUsername = makeFallbackUsername(desiredUsername, userId);
      try {
        await env.DB.prepare(
          "INSERT INTO users (id, username, display_name, avatar_url) VALUES (?, ?, ?, ?)",
        )
          .bind(userId, fallbackUsername, displayName ?? fallbackUsername, avatarUrl)
          .run();
        inserted = true;
      } catch {
        const maybeCreated = await env.DB.prepare(
          "SELECT id FROM users WHERE id = ?",
        )
          .bind(userId)
          .first<{ id: string }>();
        if (!maybeCreated) {
          return json({ error: "username_unavailable" }, request, 409);
        }
      }
    }

    if (!inserted) {
      const maybeCreated = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(userId)
        .first<{ id: string }>();
      if (!maybeCreated) {
        return json({ error: "bootstrap_failed" }, request, 500);
      }
    }
  }

  const user = await env.DB.prepare(
    "SELECT id, username, display_name, avatar_url FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }>();

  if (!user) {
    return json({ error: "bootstrap_failed" }, request, 500);
  }

  const modules = await getModulesEnabled(env, userId);

  return json(
    {
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      modulesEnabled: modules.modulesEnabled,
      firstRun: modules.firstRun,
    },
    request,
  );
}

async function handleGetModules(request: Request, env: Env, userId: string) {
  const modules = await getModulesEnabled(env, userId);
  return json({ modulesEnabled: modules.modulesEnabled, firstRun: modules.firstRun }, request);
}

async function broadcastModulesChanged(
  env: Env,
  userId: string,
  modulesEnabled: Record<ModuleId, boolean>,
) {
  const doId = env.REALTIME.idFromName(`realtime:${userId}`);
  const stub = env.REALTIME.get(doId);
  await stub.fetch("https://realtime.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({ type: "modules:changed", payload: { modulesEnabled } }),
  });
}

async function handlePutModules(request: Request, env: Env, userId: string) {
  const body = (await request.json().catch(() => null)) as {
    modulesEnabled?: Record<string, boolean>;
  } | null;

  if (!body?.modulesEnabled || typeof body.modulesEnabled !== "object") {
    return json({ error: "invalid_payload" }, request, 400);
  }
  const modulesEnabled = body.modulesEnabled;

  const now = new Date().toISOString();
  const operations = MODULE_IDS.map((moduleId, sortOrder) =>
    env.DB.prepare(
      `INSERT INTO user_modules (user_id, module_id, enabled, pinned, sort_order, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT(user_id, module_id)
       DO UPDATE SET enabled = excluded.enabled, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
    )
      .bind(userId, moduleId, modulesEnabled[moduleId] ? 1 : 0, sortOrder, now)
      .run(),
  );

  await Promise.all(operations);

  const modules = await getModulesEnabled(env, userId);
  await broadcastModulesChanged(env, userId, modules.modulesEnabled);

  return json({ modulesEnabled: modules.modulesEnabled, firstRun: false }, request);
}

async function handleRealtime(request: Request, env: Env, userId: string) {
  if (request.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const doId = env.REALTIME.idFromName(`realtime:${userId}`);
  const stub = env.REALTIME.get(doId);
  const url = new URL(request.url);
  url.pathname = "/connect";

  const forwarded = new Request(url.toString(), request);
  return stub.fetch(forwarded);
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request),
        });
      }

      if (url.pathname === "/health") {
        return json({ ok: true }, request);
      }

      let verified: VerifiedUser;
      try {
        verified = await verifyUser(request, env);
      } catch {
        return json({ error: "unauthorized" }, request, 401);
      }

      const chatResponse = await handleChatRoutes({
        request,
        env,
        userId: verified.userId,
        json,
      });
      if (chatResponse) {
        return chatResponse;
      }

      const feedResponse = await handleFeedRoutes({
        req: request,
        url,
        env,
      });
      if (feedResponse) {
        return feedResponse;
      }

      if (request.method === "POST" && url.pathname === "/bootstrap") {
        return handleBootstrap(request, env, verified.userId);
      }

      if (request.method === "GET" && url.pathname === "/modules") {
        return handleGetModules(request, env, verified.userId);
      }

      if (request.method === "PUT" && url.pathname === "/modules") {
        return handlePutModules(request, env, verified.userId);
      }

      if (request.method === "GET" && url.pathname === "/realtime/ws") {
        return handleRealtime(request, env, verified.userId);
      }

      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders(request),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "internal_error";
      console.error("[worker:error]", message, error);
      return json({ error: "internal_error", message }, request, 500);
    }
  },
};

export { RealtimeDO, RoomDO, FeedDO };
export default worker;
