import { create } from "zustand";
import { getSupabaseClient } from "../../core/services/supabase";

export type ReactionUsers = Record<string, { userId: string; username: string | null }[]>;

export type FeedPost = {
  id: string;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  body: string;
  image_url: string | null;
  created_at: string;
  edited_at: string | null;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
  reactions: ReactionUsers;
  deleted_at?: string | null;
};

export type FeedComment = {
  id: string;
  post_id: string;
  user_id: string;
  username?: string | null;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type PostVersion = {
  id: string;
  post_id: string;
  body: string;
  edited_at: string;
  edited_by: string;
};

type WsStatus = "connected" | "reconnecting" | "disconnected";

type FeedWsEvent =
  | { type: "feed:post_new"; payload: { post: FeedPost } }
  | { type: "feed:post_edit"; payload: { postId: string; body: string; edited_at: string } }
  | { type: "feed:post_delete"; payload: { postId: string } }
  | { type: "feed:post_like"; payload: { postId: string; likes_count: number } }
  | { type: "feed:post_unlike"; payload: { postId: string; likes_count: number } }
  | { type: "feed:reaction_add"; payload: { postId: string; emoji: string; userId: string } }
  | { type: "feed:reaction_remove"; payload: { postId: string; emoji: string; userId: string } }
  | { type: "feed:comment_new"; payload: { comment: FeedComment } }
  | { type: "feed:comment_delete"; payload: { commentId: string } };

type FeedStore = {
  posts: FeedPost[];
  commentsByPostId: Record<string, FeedComment[]>;
  versionsByPostId: Record<string, PostVersion[]>;
  wsStatus: WsStatus;
  activePostId: string | null;
  userFilterId: string | null;
  postDataByPostId: Record<
    string,
    {
      metadata: FeedPost & { deleted_at: string | null };
      versions: PostVersion[];
      reactions: ReactionUsers;
      comments_preview: { id: string; body: string; created_at: string; user_id: string }[];
      comments_count: number;
    }
  >;
  loadPosts: (before?: string) => Promise<void>;
  addPost: (body: string, imageUrl?: string | null) => Promise<void>;
  editPost: (postId: string, body: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  addReaction: (postId: string, emoji: string) => Promise<void>;
  removeReaction: (postId: string, emoji: string) => Promise<void>;
  loadComments: (postId: string, before?: string) => Promise<void>;
  addComment: (postId: string, body: string, parentCommentId?: string | null) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadVersions: (postId: string) => Promise<void>;
  loadPostData: (postId: string) => Promise<void>;
  applyWsEvent: (event: FeedWsEvent) => void;
  connectWs: () => Promise<void>;
  disconnectWs: () => void;
  setActivePostId: (postId: string | null) => void;
  setUserFilterId: (userId: string | null) => void;
};

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let reconnectToken = "";
const MAX_RECONNECT_ATTEMPTS = 6;

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

function getApiBaseOrThrow() {
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!value) {
    throw new Error("Config ausente: defina VITE_API_BASE_URL no .env");
  }
  return value;
}

async function feedApiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseOrThrow()}${path}`, {
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

function feedWsUrl(token: string) {
  const url = new URL(getApiBaseOrThrow());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/feed/ws";
  url.searchParams.set("token", token);
  return url.toString();
}

function mergeById(current: FeedPost[], incoming: FeedPost[]) {
  const map = new Map<string, FeedPost>();
  for (const post of current) map.set(post.id, post);
  for (const post of incoming) map.set(post.id, post);
  return Array.from(map.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function clearSocket(set: (partial: Partial<FeedStore>) => void, keepToken = false) {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  if (!keepToken) reconnectToken = "";
  const socket = ws;
  ws = null;
  if (socket) {
    socket.onopen = null;
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
  set({ wsStatus: "disconnected" });
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  posts: [],
  commentsByPostId: {},
  versionsByPostId: {},
  wsStatus: "disconnected",
  activePostId: null,
  userFilterId: null,
  postDataByPostId: {},
  loadPosts: async (before) => {
    const token = await getAccessToken();
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (before) params.set("before", before);
    const data = await feedApiFetch<{ posts: FeedPost[] }>(
      `/feed/posts?${params.toString()}`,
      token,
      {
        method: "GET",
      },
    );
    set((state) => ({
      posts: before ? mergeById(state.posts, data.posts) : data.posts,
    }));
  },
  addPost: async (body, imageUrl) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ post: FeedPost }>("/feed/posts", token, {
      method: "POST",
      body: JSON.stringify({ body, image_url: imageUrl ?? null }),
    });
    set((state) => ({ posts: mergeById(state.posts, [data.post]) }));
  },
  editPost: async (postId, body) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ body: string; edited_at: string }>(
      `/feed/posts/${encodeURIComponent(postId)}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ body }),
      },
    );
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, body: data.body, edited_at: data.edited_at } : post,
      ),
    }));
  },
  deletePost: async (postId) => {
    const token = await getAccessToken();
    await feedApiFetch(`/feed/posts/${encodeURIComponent(postId)}`, token, { method: "DELETE" });
    set((state) => ({ posts: state.posts.filter((post) => post.id !== postId) }));
  },
  likePost: async (postId) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ likes_count: number }>(
      `/feed/posts/${encodeURIComponent(postId)}/like`,
      token,
      { method: "POST" },
    );
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId
          ? { ...post, likes_count: data.likes_count, user_has_liked: true }
          : post,
      ),
    }));
  },
  unlikePost: async (postId) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ likes_count: number }>(
      `/feed/posts/${encodeURIComponent(postId)}/like`,
      token,
      { method: "DELETE" },
    );
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId
          ? { ...post, likes_count: data.likes_count, user_has_liked: false }
          : post,
      ),
    }));
  },
  addReaction: async (postId, emoji) => {
    const token = await getAccessToken();
    await feedApiFetch(`/feed/posts/${encodeURIComponent(postId)}/reactions`, token, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
  },
  removeReaction: async (postId, emoji) => {
    const token = await getAccessToken();
    await feedApiFetch(
      `/feed/posts/${encodeURIComponent(postId)}/reactions/${encodeURIComponent(emoji)}`,
      token,
      {
        method: "DELETE",
      },
    );
  },
  loadComments: async (postId, before) => {
    const token = await getAccessToken();
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (before) params.set("before", before);
    const data = await feedApiFetch<{ comments: FeedComment[] }>(
      `/feed/posts/${encodeURIComponent(postId)}/comments?${params.toString()}`,
      token,
      { method: "GET" },
    );
    set((state) => {
      const current = state.commentsByPostId[postId] ?? [];
      const merged = before
        ? [...data.comments, ...current].filter(
            (comment, index, arr) => arr.findIndex((it) => it.id === comment.id) === index,
          )
        : data.comments;
      return { commentsByPostId: { ...state.commentsByPostId, [postId]: merged } };
    });
  },
  addComment: async (postId, body, parentCommentId) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ comment: FeedComment }>(
      `/feed/posts/${encodeURIComponent(postId)}/comments`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ body, parent_comment_id: parentCommentId ?? null }),
      },
    );
    set((state) => {
      const current = state.commentsByPostId[postId] ?? [];
      return {
        commentsByPostId: { ...state.commentsByPostId, [postId]: [...current, data.comment] },
        posts: state.posts.map((post) =>
          post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post,
        ),
      };
    });
  },
  deleteComment: async (commentId) => {
    const token = await getAccessToken();
    await feedApiFetch(`/feed/comments/${encodeURIComponent(commentId)}`, token, {
      method: "DELETE",
    });
    set((state) => {
      const next: Record<string, FeedComment[]> = {};
      for (const [postId, comments] of Object.entries(state.commentsByPostId)) {
        next[postId] = comments.map((comment) =>
          comment.id === commentId ? { ...comment, deleted_at: new Date().toISOString() } : comment,
        );
      }
      return { commentsByPostId: next };
    });
  },
  loadVersions: async (postId) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<{ versions: PostVersion[] }>(
      `/feed/posts/${encodeURIComponent(postId)}/versions`,
      token,
      { method: "GET" },
    );
    set((state) => ({ versionsByPostId: { ...state.versionsByPostId, [postId]: data.versions } }));
  },
  loadPostData: async (postId) => {
    const token = await getAccessToken();
    const data = await feedApiFetch<FeedStore["postDataByPostId"][string]>(
      `/feed/posts/${encodeURIComponent(postId)}/data`,
      token,
      { method: "GET" },
    );
    set((state) => ({ postDataByPostId: { ...state.postDataByPostId, [postId]: data } }));
  },
  applyWsEvent: (event) => {
    set((state) => {
      if (event.type === "feed:post_new") {
        return { posts: mergeById(state.posts, [event.payload.post]) };
      }

      if (event.type === "feed:post_edit") {
        return {
          posts: state.posts.map((post) =>
            post.id === event.payload.postId
              ? { ...post, body: event.payload.body, edited_at: event.payload.edited_at }
              : post,
          ),
        };
      }

      if (event.type === "feed:post_delete") {
        return { posts: state.posts.filter((post) => post.id !== event.payload.postId) };
      }

      if (event.type === "feed:post_like" || event.type === "feed:post_unlike") {
        return {
          posts: state.posts.map((post) =>
            post.id === event.payload.postId
              ? { ...post, likes_count: event.payload.likes_count }
              : post,
          ),
        };
      }

      if (event.type === "feed:reaction_add") {
        return {
          posts: state.posts.map((post) => {
            if (post.id !== event.payload.postId) return post;
            const next = { ...post.reactions };
            const users = next[event.payload.emoji] ?? [];
            if (!users.some((user) => user.userId === event.payload.userId)) {
              next[event.payload.emoji] = [
                ...users,
                { userId: event.payload.userId, username: null },
              ];
            }
            return { ...post, reactions: next };
          }),
        };
      }

      if (event.type === "feed:reaction_remove") {
        return {
          posts: state.posts.map((post) => {
            if (post.id !== event.payload.postId) return post;
            const next = { ...post.reactions };
            const users = (next[event.payload.emoji] ?? []).filter(
              (user) => user.userId !== event.payload.userId,
            );
            if (users.length === 0) {
              delete next[event.payload.emoji];
            } else {
              next[event.payload.emoji] = users;
            }
            return { ...post, reactions: next };
          }),
        };
      }

      if (event.type === "feed:comment_new") {
        const comment = event.payload.comment;
        const current = state.commentsByPostId[comment.post_id] ?? [];
        if (current.some((item) => item.id === comment.id)) return state;
        return {
          commentsByPostId: { ...state.commentsByPostId, [comment.post_id]: [...current, comment] },
          posts: state.posts.map((post) =>
            post.id === comment.post_id
              ? { ...post, comments_count: post.comments_count + 1 }
              : post,
          ),
        };
      }

      if (event.type === "feed:comment_delete") {
        const next: Record<string, FeedComment[]> = {};
        for (const [postId, comments] of Object.entries(state.commentsByPostId)) {
          next[postId] = comments.map((comment) =>
            comment.id === event.payload.commentId
              ? { ...comment, deleted_at: new Date().toISOString() }
              : comment,
          );
        }
        return { commentsByPostId: next };
      }

      return state;
    });
  },
  connectWs: async () => {
    try {
      reconnectToken = await getAccessToken();
    } catch {
      set({ wsStatus: "disconnected" });
      return;
    }
    clearSocket(set, true);

    const open = () => {
      if (!reconnectToken) return;
      ws = new WebSocket(feedWsUrl(reconnectToken));

      ws.onopen = () => {
        reconnectAttempt = 0;
        set({ wsStatus: "connected" });
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as { event?: FeedWsEvent } | FeedWsEvent;
          const normalized = "event" in parsed && parsed.event ? parsed.event : parsed;
          get().applyWsEvent(normalized as FeedWsEvent);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (!reconnectToken) return;
        if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
          set({ wsStatus: "disconnected" });
          return;
        }
        set({ wsStatus: "reconnecting" });
        reconnectAttempt += 1;
        const delay = Math.min(500 * 2 ** (reconnectAttempt - 1), 30000);
        reconnectTimer = window.setTimeout(() => {
          void get().loadPosts();
          open();
        }, delay);
      };
    };

    open();
  },
  disconnectWs: () => clearSocket(set),
  setActivePostId: (postId) => set({ activePostId: postId }),
  setUserFilterId: (userFilterId) => set({ userFilterId }),
}));
