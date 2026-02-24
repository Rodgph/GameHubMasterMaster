type UsersEnv = {
  DB: D1Database;
  REALTIME: DurableObjectNamespace;
};

type JsonResponse = (data: unknown, request: Request, status?: number) => Response;

type UserRouteContext = {
  request: Request;
  env: UsersEnv;
  userId: string;
  json: JsonResponse;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type UsersPatchBody = {
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

const MAX_AVATAR_URL_LENGTH = 750_000;

function sanitizeUsername(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    throw new Error("invalid_username");
  }
  return normalized;
}

function parseLimit(url: URL, fallback: number, max: number) {
  const raw = Number(url.searchParams.get("limit") ?? String(fallback));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(raw)));
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
  };
}

function isUsernameConflictError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("username_unavailable") ||
    (text.includes("unique") && text.includes("username")) ||
    text.includes("duplicate key")
  );
}

function isPayloadTooLargeError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("too large") ||
    text.includes("too big") ||
    text.includes("string or blob too big") ||
    text.includes("request body too large") ||
    text.includes("maximum statement")
  );
}

async function getRealtimeRecipientsForUser(env: UsersEnv, userId: string) {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT rm2.user_id
     FROM chat_room_members rm1
     JOIN chat_room_members rm2 ON rm1.room_id = rm2.room_id
     WHERE rm1.user_id = ?`,
  )
    .bind(userId)
    .all<{ user_id: string }>();

  const recipients = new Set<string>([userId]);
  for (const row of rows.results ?? []) {
    if (row.user_id) recipients.add(row.user_id);
  }
  return [...recipients];
}

async function broadcastUserUpdated(env: UsersEnv, user: ReturnType<typeof mapUser>) {
  const recipients = await getRealtimeRecipientsForUser(env, user.id);
  const payload = JSON.stringify({
    type: "user:updated",
    payload: {
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
    },
  });

  await Promise.all(
    recipients.map(async (recipientId) => {
      try {
        const doId = env.REALTIME.idFromName(`realtime:${recipientId}`);
        const stub = env.REALTIME.get(doId);
        await stub.fetch("https://realtime.internal/broadcast", {
          method: "POST",
          body: payload,
        });
      } catch {
        // keep response successful even when realtime fanout fails for one recipient
      }
    }),
  );
}

async function listUsers({ request, env, json }: UserRouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url, 20, 50);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/^@+/, "").toLowerCase();

  let rows: UserRow[] = [];
  if (!query) {
    const result = await env.DB.prepare(
      `SELECT id, username, display_name, avatar_url, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT ?`,
    )
      .bind(limit)
      .all<UserRow>();
    rows = result.results ?? [];
  } else {
    const like = `%${query}%`;
    const result = await env.DB.prepare(
      `SELECT id, username, display_name, avatar_url, created_at
       FROM users
       WHERE username LIKE ? OR COALESCE(display_name, '') LIKE ?
       ORDER BY username ASC
       LIMIT ?`,
    )
      .bind(like, like, limit)
      .all<UserRow>();
    rows = result.results ?? [];
  }

  return json({ users: rows.map(mapUser) }, request);
}

async function getUserById({ request, env, json }: UserRouteContext, targetUserId: string) {
  const row = await env.DB.prepare(
    `SELECT id, username, display_name, avatar_url, created_at
     FROM users
     WHERE id = ?`,
  )
    .bind(targetUserId)
    .first<UserRow>();

  return json({ user: row ? mapUser(row) : null }, request);
}

async function getUsersByIds({ request, env, json }: UserRouteContext) {
  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean))]
    .slice(0, 50);

  if (ids.length === 0) {
    return json({ users: [] }, request);
  }

  const placeholders = ids.map(() => "?").join(", ");
  const query = `SELECT id, username, display_name, avatar_url, created_at FROM users WHERE id IN (${placeholders})`;
  const rows = await env.DB.prepare(query).bind(...ids).all<UserRow>();
  const rowsById = new Map((rows.results ?? []).map((row) => [row.id, row] as const));
  const ordered = ids.map((id) => rowsById.get(id)).filter((row): row is UserRow => Boolean(row));

  return json({ users: ordered.map(mapUser) }, request);
}

async function updateCurrentUser({ request, env, userId, json }: UserRouteContext) {
  const body = (await request.json().catch(() => null)) as UsersPatchBody | null;
  if (!body || typeof body !== "object") {
    return json({ error: "invalid_payload" }, request, 400);
  }

  const setParts: string[] = [];
  const values: unknown[] = [];

  if (Object.prototype.hasOwnProperty.call(body, "username")) {
    if (typeof body.username !== "string") {
      return json({ error: "invalid_username" }, request, 400);
    }
    setParts.push("username = ?");
    values.push(sanitizeUsername(body.username));
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
    if (body.displayName !== null && typeof body.displayName !== "string") {
      return json({ error: "invalid_display_name" }, request, 400);
    }
    setParts.push("display_name = ?");
    values.push(body.displayName?.trim() || null);
  }

  if (Object.prototype.hasOwnProperty.call(body, "avatarUrl")) {
    if (body.avatarUrl !== null && typeof body.avatarUrl !== "string") {
      return json({ error: "invalid_avatar_url" }, request, 400);
    }
    const normalized = body.avatarUrl?.trim() || null;
    if (normalized && normalized.length > MAX_AVATAR_URL_LENGTH) {
      return json({ error: "avatar_too_large" }, request, 413);
    }
    setParts.push("avatar_url = ?");
    values.push(normalized);
  }

  if (setParts.length === 0) {
    return json({ error: "nothing_to_update" }, request, 400);
  }

  try {
    await env.DB.prepare(`UPDATE users SET ${setParts.join(", ")} WHERE id = ?`)
      .bind(...values, userId)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "update_failed";
    if (isUsernameConflictError(message)) {
      return json({ error: "username_unavailable" }, request, 409);
    }
    if (isPayloadTooLargeError(message)) {
      return json({ error: "avatar_too_large" }, request, 413);
    }
    return json({ error: "update_failed", message }, request, 500);
  }

  const row = await env.DB.prepare(
    `SELECT id, username, display_name, avatar_url, created_at
     FROM users
     WHERE id = ?`,
  )
    .bind(userId)
    .first<UserRow>();

  if (!row) {
    return json({ error: "not_found" }, request, 404);
  }

  const mappedUser = mapUser(row);
  try {
    await broadcastUserUpdated(env, mappedUser);
  } catch {
    // profile update should not fail due to realtime broadcast issues
  }

  return json({ user: mappedUser }, request);
}

export async function handleUserRoutes(context: UserRouteContext): Promise<Response | null> {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET" && url.pathname === "/users") {
    return listUsers(context);
  }

  if (method === "GET" && url.pathname === "/users/by-ids") {
    return getUsersByIds(context);
  }

  if (method === "PUT" && url.pathname === "/users/me") {
    return updateCurrentUser(context);
  }

  const userMatch = url.pathname.match(/^\/users\/([^/]+)$/);
  if (method === "GET" && userMatch) {
    const targetUserId = decodeURIComponent(userMatch[1]);
    return getUserById(context, targetUserId);
  }

  return null;
}
