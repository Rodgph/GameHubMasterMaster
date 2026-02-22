type ChatEnv = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  REALTIME: DurableObjectNamespace;
};

type JsonResponse = (data: unknown, request: Request, status?: number) => Response;

type ChatRouteContext = {
  request: Request;
  env: ChatEnv;
  userId: string;
  json: JsonResponse;
};

type ChatMessageRow = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

function parseLimit(url: URL) {
  const raw = Number(url.searchParams.get("limit") ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

async function ensureMembership(env: ChatEnv, roomId: string, userId: string) {
  const row = await env.DB.prepare(
    "SELECT 1 as ok FROM chat_room_members WHERE room_id = ? AND user_id = ?",
  )
    .bind(roomId, userId)
    .first<{ ok: number }>();
  return Boolean(row?.ok);
}

async function broadcastRoomEvent(env: ChatEnv, roomId: string, event: unknown) {
  const doId = env.ROOMS.idFromName(`room:${roomId}`);
  const stub = env.ROOMS.get(doId);
  await stub.fetch("https://room.internal/broadcast", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

async function broadcastRoomUpdated(
  env: ChatEnv,
  roomId: string,
  payload: { lastMessageAt: string; lastMessagePreview: string; senderId: string },
) {
  const members = await env.DB.prepare("SELECT user_id FROM chat_room_members WHERE room_id = ?")
    .bind(roomId)
    .all<{ user_id: string }>();

  const body = JSON.stringify({
    type: "room_updated",
    payload: {
      roomId,
      lastMessageAt: payload.lastMessageAt,
      lastMessagePreview: payload.lastMessagePreview,
      senderId: payload.senderId,
    },
  });

  for (const member of members.results ?? []) {
    const doId = env.REALTIME.idFromName(`realtime:${member.user_id}`);
    const stub = env.REALTIME.get(doId);
    await stub.fetch("https://realtime.internal/broadcast", {
      method: "POST",
      body,
    });
  }
}

function normalizeMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  };
}

async function createRoom({ request, env, userId, json }: ChatRouteContext) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    memberIds?: string[];
  } | null;

  const roomId = crypto.randomUUID();
  const title = body?.title?.trim() || null;
  const incomingMembers = body?.memberIds ?? [];
  const memberIds = new Set<string>([
    userId,
    ...incomingMembers.filter((id) => typeof id === "string"),
  ]);

  await env.DB.prepare("INSERT INTO chat_rooms (id, created_by, title) VALUES (?, ?, ?)")
    .bind(roomId, userId, title)
    .run();

  for (const memberId of memberIds) {
    await env.DB.prepare(
      "INSERT INTO chat_room_members (room_id, user_id, role) VALUES (?, ?, 'member')",
    )
      .bind(roomId, memberId)
      .run();
  }

  return json({ roomId }, request, 201);
}

async function listRooms({ request, env, userId, json }: ChatRouteContext) {
  const rows = await env.DB.prepare(
    `SELECT r.id as room_id,
            r.title as title,
            MAX(m.created_at) as last_message_at
     FROM chat_room_members rm
     JOIN chat_rooms r ON r.id = rm.room_id
     LEFT JOIN chat_messages m ON m.room_id = r.id AND m.deleted_at IS NULL
     WHERE rm.user_id = ?
     GROUP BY r.id, r.title
     ORDER BY COALESCE(MAX(m.created_at), r.created_at) DESC`,
  )
    .bind(userId)
    .all<{ room_id: string; title: string | null; last_message_at: string | null }>();

  return json(
    {
      rooms: (rows.results ?? []).map((row) => ({
        roomId: row.room_id,
        title: row.title,
        lastMessageAt: row.last_message_at,
      })),
    },
    request,
  );
}

async function listMessages({ request, env, userId, json }: ChatRouteContext, roomId: string) {
  const isMember = await ensureMembership(env, roomId, userId);
  if (!isMember) {
    return json({ error: "forbidden" }, request, 403);
  }

  const url = new URL(request.url);
  const limit = parseLimit(url);
  const before = url.searchParams.get("before");
  const since = url.searchParams.get("since");

  let sql =
    "SELECT id, room_id, user_id, body, created_at, edited_at, deleted_at FROM chat_messages WHERE room_id = ?";
  const params: unknown[] = [roomId];

  if (before) {
    sql += " AND created_at < ?";
    params.push(before);
  }

  if (since) {
    sql += " AND created_at > ?";
    params.push(since);
  }

  const descOrder = !since;
  sql += descOrder ? " ORDER BY created_at DESC LIMIT ?" : " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql)
    .bind(...params)
    .all<ChatMessageRow>();

  const mapped = (rows.results ?? []).map(normalizeMessage);
  if (descOrder) mapped.reverse();

  return json({ messages: mapped }, request);
}

async function createMessage({ request, env, userId, json }: ChatRouteContext, roomId: string) {
  const isMember = await ensureMembership(env, roomId, userId);
  if (!isMember) {
    return json({ error: "forbidden" }, request, 403);
  }

  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) {
    return json({ error: "message_required" }, request, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO chat_messages (id, room_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, roomId, userId, text, createdAt)
    .run();

  const message = {
    id,
    roomId,
    userId,
    body: text,
    createdAt,
    editedAt: null,
    deletedAt: null,
  };

  await broadcastRoomEvent(env, roomId, {
    type: "chat:message_new",
    payload: { message },
  });
  await broadcastRoomUpdated(env, roomId, {
    lastMessageAt: createdAt,
    lastMessagePreview: text.slice(0, 120),
    senderId: userId,
  });

  return json({ message }, request, 201);
}

async function editMessage({ request, env, userId, json }: ChatRouteContext, messageId: string) {
  const current = await env.DB.prepare(
    "SELECT id, room_id, user_id, deleted_at FROM chat_messages WHERE id = ?",
  )
    .bind(messageId)
    .first<{ id: string; room_id: string; user_id: string; deleted_at: string | null }>();

  if (!current) return json({ error: "not_found" }, request, 404);
  if (current.user_id !== userId) return json({ error: "forbidden" }, request, 403);
  if (current.deleted_at) return json({ error: "message_deleted" }, request, 409);

  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return json({ error: "message_required" }, request, 400);

  const editedAt = new Date().toISOString();
  await env.DB.prepare("UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?")
    .bind(text, editedAt, messageId)
    .run();

  await broadcastRoomEvent(env, current.room_id, {
    type: "chat:message_edit",
    payload: { messageId, body: text, editedAt },
  });
  await broadcastRoomUpdated(env, current.room_id, {
    lastMessageAt: editedAt,
    lastMessagePreview: text.slice(0, 120),
    senderId: userId,
  });

  return json({ messageId, body: text, editedAt }, request);
}

async function deleteMessage({ request, env, userId, json }: ChatRouteContext, messageId: string) {
  const current = await env.DB.prepare(
    "SELECT id, room_id, user_id, deleted_at FROM chat_messages WHERE id = ?",
  )
    .bind(messageId)
    .first<{ id: string; room_id: string; user_id: string; deleted_at: string | null }>();

  if (!current) return json({ error: "not_found" }, request, 404);
  if (current.user_id !== userId) return json({ error: "forbidden" }, request, 403);
  if (current.deleted_at) return json({ messageId, deletedAt: current.deleted_at }, request);

  const deletedAt = new Date().toISOString();
  await env.DB.prepare("UPDATE chat_messages SET deleted_at = ? WHERE id = ?")
    .bind(deletedAt, messageId)
    .run();

  await broadcastRoomEvent(env, current.room_id, {
    type: "chat:message_delete",
    payload: { messageId, deletedAt },
  });
  await broadcastRoomUpdated(env, current.room_id, {
    lastMessageAt: deletedAt,
    lastMessagePreview: "[mensagem removida]",
    senderId: userId,
  });

  return json({ messageId, deletedAt }, request);
}

async function openRoomWs({ request, env, userId, json }: ChatRouteContext, roomId: string) {
  const isMember = await ensureMembership(env, roomId, userId);
  if (!isMember) {
    return json({ error: "forbidden" }, request, 403);
  }

  if (request.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const doId = env.ROOMS.idFromName(`room:${roomId}`);
  const stub = env.ROOMS.get(doId);
  const url = new URL(request.url);
  url.pathname = "/connect";
  url.searchParams.set("userId", userId);

  const forwarded = new Request(url.toString(), request);
  return stub.fetch(forwarded);
}

export async function handleChatRoutes(context: ChatRouteContext): Promise<Response | null> {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "POST" && url.pathname === "/chat/rooms") {
    return createRoom(context);
  }

  if (method === "GET" && url.pathname === "/chat/rooms") {
    return listRooms(context);
  }

  const roomMessagesMatch = url.pathname.match(/^\/chat\/rooms\/([^/]+)\/messages$/);
  if (roomMessagesMatch) {
    const roomId = decodeURIComponent(roomMessagesMatch[1]);
    if (method === "GET") {
      return listMessages(context, roomId);
    }
    if (method === "POST") {
      return createMessage(context, roomId);
    }
  }

  const roomWsMatch = url.pathname.match(/^\/chat\/rooms\/([^/]+)\/ws$/);
  if (roomWsMatch && method === "GET") {
    const roomId = decodeURIComponent(roomWsMatch[1]);
    return openRoomWs(context, roomId);
  }

  const editDeleteMatch = url.pathname.match(/^\/chat\/messages\/([^/]+)$/);
  if (editDeleteMatch) {
    const messageId = decodeURIComponent(editDeleteMatch[1]);
    if (method === "PUT") {
      return editMessage(context, messageId);
    }
    if (method === "DELETE") {
      return deleteMessage(context, messageId);
    }
  }

  return null;
}
