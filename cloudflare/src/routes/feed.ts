import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RouteHandler } from "./index";

type FeedEnv = {
  DB: D1Database;
  FEED: DurableObjectNamespace;
  SUPABASE_PROJECT_URL: string;
  SUPABASE_JWT_ISS: string;
  SUPABASE_JWT_AUD: string;
};

type FeedPostRow = {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  body: string;
  image_url: string | null;
  created_at: string;
  edited_at: string | null;
  likes_count: number;
  comments_count: number;
  user_has_liked: number;
};

type FeedCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  username: string | null;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

function parseLimit(url: URL, fallback = 20, max = 100) {
  const raw = Number(url.searchParams.get("limit") ?? String(fallback));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(raw)));
}

function getBearerToken(req: Request, url: URL) {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  return url.searchParams.get("token");
}

function getJwks(env: FeedEnv) {
  const key = env.SUPABASE_PROJECT_URL;
  const cached = jwksCache.get(key);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(
    new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_PROJECT_URL),
  );
  jwksCache.set(key, jwks);
  return jwks;
}

async function verifyUserId(req: Request, url: URL, env: FeedEnv) {
  const token = getBearerToken(req, url);
  if (!token) throw new Error("missing_token");
  const verified = await jwtVerify(token, getJwks(env), {
    issuer: env.SUPABASE_JWT_ISS,
    audience: env.SUPABASE_JWT_AUD,
  });
  if (!verified.payload.sub || typeof verified.payload.sub !== "string") {
    throw new Error("invalid_sub");
  }
  return verified.payload.sub;
}

function mapPost(row: FeedPostRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    avatar_url: row.avatar_url,
    body: row.body,
    image_url: row.image_url,
    created_at: row.created_at,
    edited_at: row.edited_at,
    likes_count: Number(row.likes_count ?? 0),
    comments_count: Number(row.comments_count ?? 0),
    user_has_liked: Boolean(row.user_has_liked ?? 0),
  };
}

function mapComment(row: FeedCommentRow) {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    username: row.username,
    body: row.body,
    parent_comment_id: row.parent_comment_id,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
  };
}

async function postExists(env: FeedEnv, postId: string) {
  const row = await env.DB.prepare("SELECT id FROM feed_posts WHERE id = ? AND deleted_at IS NULL")
    .bind(postId)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

async function getLikesCount(env: FeedEnv, postId: string) {
  const row = await env.DB.prepare("SELECT COUNT(*) as count FROM feed_likes WHERE post_id = ?")
    .bind(postId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function getPostReactions(env: FeedEnv, postId: string) {
  const rows = await env.DB.prepare(
    `SELECT r.emoji as emoji, r.user_id as user_id, u.username as username
     FROM feed_post_reactions r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.post_id = ?
     ORDER BY r.created_at ASC`,
  )
    .bind(postId)
    .all<{ emoji: string; user_id: string; username: string | null }>();

  const grouped: Record<string, { userId: string; username: string | null }[]> = {};
  for (const row of rows.results ?? []) {
    grouped[row.emoji] = grouped[row.emoji] ?? [];
    grouped[row.emoji].push({ userId: row.user_id, username: row.username });
  }
  return grouped;
}

async function broadcastFeedEvent(env: FeedEnv, event: unknown) {
  const doId = env.FEED.idFromName("feed:global");
  const stub = env.FEED.get(doId);
  await stub.fetch("https://feed.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({ event }),
  });
}

export const handleFeedRoutes: RouteHandler<FeedEnv> = async ({ req, url, env }) => {
  if (!url.pathname.startsWith("/feed")) return null;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  let userId = "";
  try {
    userId = await verifyUserId(req, url, env);
  } catch {
    return json(req, { error: "unauthorized" }, 401);
  }

  if (req.method === "GET" && url.pathname === "/feed/posts") {
    const limit = parseLimit(url, 20);
    const before = url.searchParams.get("before");
    let sql = `SELECT p.id, p.user_id, u.username, u.avatar_url, p.body, p.image_url, p.created_at, p.edited_at,
      (SELECT COUNT(*) FROM feed_likes l WHERE l.post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM feed_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) as comments_count,
      (SELECT CASE WHEN EXISTS (
        SELECT 1 FROM feed_likes ul WHERE ul.post_id = p.id AND ul.user_id = ?
      ) THEN 1 ELSE 0 END) as user_has_liked
      FROM feed_posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL`;
    const params: unknown[] = [userId];

    if (before) {
      sql += " AND p.created_at < ?";
      params.push(before);
    }
    sql += " ORDER BY p.created_at DESC LIMIT ?";
    params.push(limit);

    const rows = await env.DB.prepare(sql)
      .bind(...params)
      .all<FeedPostRow>();

    const posts = await Promise.all(
      (rows.results ?? []).map(async (row) => ({
        ...mapPost(row),
        reactions: await getPostReactions(env, row.id),
      })),
    );

    return json(req, { posts });
  }

  if (req.method === "POST" && url.pathname === "/feed/posts") {
    const body = (await req.json().catch(() => null)) as {
      body?: string;
      image_url?: string;
    } | null;
    const text = body?.body?.trim();
    const imageUrl = body?.image_url?.trim() || null;
    if (!text) return json(req, { error: "body_required" }, 400);

    const post = {
      id: crypto.randomUUID(),
      user_id: userId,
      body: text,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      edited_at: null as string | null,
      likes_count: 0,
      comments_count: 0,
      user_has_liked: false,
      reactions: {} as Record<string, { userId: string; username: string | null }[]>,
    };

    await env.DB.prepare(
      "INSERT INTO feed_posts (id, user_id, body, image_url, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(post.id, post.user_id, post.body, post.image_url, post.created_at)
      .run();

    await broadcastFeedEvent(env, { type: "feed:post_new", payload: { post } });
    return json(req, { post }, 201);
  }

  const editPostMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)$/);
  if (editPostMatch && req.method === "PUT") {
    const postId = decodeURIComponent(editPostMatch[1]);
    const current = await env.DB.prepare(
      "SELECT user_id, body, deleted_at FROM feed_posts WHERE id = ?",
    )
      .bind(postId)
      .first<{ user_id: string; body: string; deleted_at: string | null }>();
    if (!current) return json(req, { error: "not_found" }, 404);
    if (current.user_id !== userId) return json(req, { error: "forbidden" }, 403);
    if (current.deleted_at) return json(req, { error: "post_deleted" }, 409);

    const body = (await req.json().catch(() => null)) as { body?: string } | null;
    const text = body?.body?.trim();
    if (!text) return json(req, { error: "body_required" }, 400);

    const editedAt = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO feed_post_versions (id, post_id, body, edited_at, edited_by) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), postId, current.body, editedAt, userId)
      .run();

    await env.DB.prepare("UPDATE feed_posts SET body = ?, edited_at = ? WHERE id = ?")
      .bind(text, editedAt, postId)
      .run();

    await broadcastFeedEvent(env, {
      type: "feed:post_edit",
      payload: { postId, body: text, edited_at: editedAt },
    });
    return json(req, { postId, body: text, edited_at: editedAt });
  }

  if (editPostMatch && req.method === "DELETE") {
    const postId = decodeURIComponent(editPostMatch[1]);
    const current = await env.DB.prepare("SELECT user_id, deleted_at FROM feed_posts WHERE id = ?")
      .bind(postId)
      .first<{ user_id: string; deleted_at: string | null }>();
    if (!current) return json(req, { error: "not_found" }, 404);
    if (current.user_id !== userId) return json(req, { error: "forbidden" }, 403);
    if (!current.deleted_at) {
      await env.DB.prepare("UPDATE feed_posts SET deleted_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), postId)
        .run();
      await broadcastFeedEvent(env, { type: "feed:post_delete", payload: { postId } });
    }
    return json(req, { postId });
  }

  const likeMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/like$/);
  if (likeMatch) {
    const postId = decodeURIComponent(likeMatch[1]);
    if (!(await postExists(env, postId))) return json(req, { error: "not_found" }, 404);

    if (req.method === "POST") {
      await env.DB.prepare("INSERT OR IGNORE INTO feed_likes (post_id, user_id) VALUES (?, ?)")
        .bind(postId, userId)
        .run();
      const likes_count = await getLikesCount(env, postId);
      await broadcastFeedEvent(env, { type: "feed:post_like", payload: { postId, likes_count } });
      return json(req, { likes_count });
    }

    if (req.method === "DELETE") {
      await env.DB.prepare("DELETE FROM feed_likes WHERE post_id = ? AND user_id = ?")
        .bind(postId, userId)
        .run();
      const likes_count = await getLikesCount(env, postId);
      await broadcastFeedEvent(env, {
        type: "feed:post_unlike",
        payload: { postId, likes_count },
      });
      return json(req, { likes_count });
    }
  }

  const commentsMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const postId = decodeURIComponent(commentsMatch[1]);
    if (!(await postExists(env, postId))) return json(req, { error: "not_found" }, 404);

    if (req.method === "GET") {
      const limit = parseLimit(url, 20);
      const before = url.searchParams.get("before");
      let sql = `SELECT c.id, c.post_id, c.user_id, u.username, c.body, c.parent_comment_id, c.created_at, c.deleted_at
         FROM feed_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ? AND c.deleted_at IS NULL`;
      const params: unknown[] = [postId];
      if (before) {
        sql += " AND c.created_at < ?";
        params.push(before);
      }
      sql += " ORDER BY c.created_at ASC LIMIT ?";
      params.push(limit);

      const rows = await env.DB.prepare(sql)
        .bind(...params)
        .all<FeedCommentRow>();
      return json(req, { comments: (rows.results ?? []).map(mapComment) });
    }

    if (req.method === "POST") {
      const body = (await req.json().catch(() => null)) as {
        body?: string;
        parent_comment_id?: string | null;
      } | null;
      const text = body?.body?.trim();
      const parent_comment_id = body?.parent_comment_id ?? null;
      if (!text) return json(req, { error: "body_required" }, 400);

      if (parent_comment_id) {
        const parent = await env.DB.prepare(
          "SELECT id FROM feed_comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL",
        )
          .bind(parent_comment_id, postId)
          .first<{ id: string }>();
        if (!parent) return json(req, { error: "invalid_parent_comment_id" }, 400);
      }

      const comment = {
        id: crypto.randomUUID(),
        post_id: postId,
        user_id: userId,
        username: null,
        body: text,
        parent_comment_id,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      await env.DB.prepare(
        "INSERT INTO feed_comments (id, post_id, user_id, body, parent_comment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          comment.id,
          comment.post_id,
          comment.user_id,
          comment.body,
          comment.parent_comment_id,
          comment.created_at,
        )
        .run();
      await broadcastFeedEvent(env, { type: "feed:comment_new", payload: { comment } });
      return json(req, { comment }, 201);
    }
  }

  const deleteCommentMatch = url.pathname.match(/^\/feed\/comments\/([^/]+)$/);
  if (deleteCommentMatch && req.method === "DELETE") {
    const commentId = decodeURIComponent(deleteCommentMatch[1]);
    const row = await env.DB.prepare("SELECT user_id, deleted_at FROM feed_comments WHERE id = ?")
      .bind(commentId)
      .first<{ user_id: string; deleted_at: string | null }>();
    if (!row) return json(req, { error: "not_found" }, 404);
    if (row.user_id !== userId) return json(req, { error: "forbidden" }, 403);
    if (!row.deleted_at) {
      await env.DB.prepare("UPDATE feed_comments SET deleted_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), commentId)
        .run();
      await broadcastFeedEvent(env, { type: "feed:comment_delete", payload: { commentId } });
    }
    return json(req, { commentId });
  }

  const reactionAddMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/reactions$/);
  if (reactionAddMatch && req.method === "POST") {
    const postId = decodeURIComponent(reactionAddMatch[1]);
    if (!(await postExists(env, postId))) return json(req, { error: "not_found" }, 404);
    const body = (await req.json().catch(() => null)) as { emoji?: string } | null;
    const emoji = body?.emoji?.trim();
    if (!emoji) return json(req, { error: "emoji_required" }, 400);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO feed_post_reactions (post_id, user_id, emoji) VALUES (?, ?, ?)",
    )
      .bind(postId, userId, emoji)
      .run();
    await broadcastFeedEvent(env, {
      type: "feed:reaction_add",
      payload: { postId, emoji, userId },
    });
    return json(req, { ok: true });
  }

  const reactionDeleteMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/reactions\/([^/]+)$/);
  if (reactionDeleteMatch && req.method === "DELETE") {
    const postId = decodeURIComponent(reactionDeleteMatch[1]);
    const emoji = decodeURIComponent(reactionDeleteMatch[2]);
    await env.DB.prepare(
      "DELETE FROM feed_post_reactions WHERE post_id = ? AND user_id = ? AND emoji = ?",
    )
      .bind(postId, userId, emoji)
      .run();
    await broadcastFeedEvent(env, {
      type: "feed:reaction_remove",
      payload: { postId, emoji, userId },
    });
    return json(req, { ok: true });
  }

  const versionsMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/versions$/);
  if (versionsMatch && req.method === "GET") {
    const postId = decodeURIComponent(versionsMatch[1]);
    const rows = await env.DB.prepare(
      `SELECT id, post_id, body, edited_at, edited_by
       FROM feed_post_versions
       WHERE post_id = ?
       ORDER BY edited_at DESC`,
    )
      .bind(postId)
      .all<{ id: string; post_id: string; body: string; edited_at: string; edited_by: string }>();
    return json(req, { versions: rows.results ?? [] });
  }

  const postDataMatch = url.pathname.match(/^\/feed\/posts\/([^/]+)\/data$/);
  if (postDataMatch && req.method === "GET") {
    const postId = decodeURIComponent(postDataMatch[1]);
    const post = await env.DB.prepare(
      "SELECT id, user_id, body, image_url, created_at, edited_at, deleted_at FROM feed_posts WHERE id = ?",
    )
      .bind(postId)
      .first<{
        id: string;
        user_id: string;
        body: string;
        image_url: string | null;
        created_at: string;
        edited_at: string | null;
        deleted_at: string | null;
      }>();
    if (!post) return json(req, { error: "not_found" }, 404);

    const versions = await env.DB.prepare(
      "SELECT id, post_id, body, edited_at, edited_by FROM feed_post_versions WHERE post_id = ? ORDER BY edited_at DESC",
    )
      .bind(postId)
      .all<{ id: string; post_id: string; body: string; edited_at: string; edited_by: string }>();

    const comments = await env.DB.prepare(
      "SELECT id, body, created_at, user_id FROM feed_comments WHERE post_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5",
    )
      .bind(postId)
      .all<{ id: string; body: string; created_at: string; user_id: string }>();

    const reactions = await getPostReactions(env, postId);

    return json(req, {
      metadata: post,
      versions: versions.results ?? [],
      reactions,
      comments_preview: comments.results ?? [],
      comments_count: Number(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) as count FROM feed_comments WHERE post_id = ? AND deleted_at IS NULL",
          )
            .bind(postId)
            .first<{ count: number }>()
        )?.count ?? 0,
      ),
    });
  }

  if (req.method === "GET" && url.pathname === "/feed/ws") {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426, headers: corsHeaders(req) });
    }
    const doId = env.FEED.idFromName("feed:global");
    const stub = env.FEED.get(doId);
    const targetUrl = new URL(req.url);
    targetUrl.pathname = "/connect";
    targetUrl.searchParams.set("userId", userId);
    return stub.fetch(new Request(targetUrl.toString(), req));
  }

  return json(req, { error: "not_found" }, 404);
};
