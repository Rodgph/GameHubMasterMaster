import { getSupabaseClient } from "../../../core/services/supabase";

const STORY_BUCKET = "chat-stories";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 5 * 60 * 1000;

type StoryType = "text" | "media" | "mixed";

export type ChatStory = {
  id: string;
  user_id: string;
  type: StoryType;
  text: string | null;
  media_path: string | null;
  media_type: string | null;
  created_at: string;
  expires_at: string;
};

type SignedCacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, SignedCacheEntry>();

function extFromFile(file: File) {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) {
    return name.slice(dot + 1).toLowerCase();
  }
  const [type, subtype] = file.type.split("/");
  if (type && subtype) {
    return subtype.toLowerCase();
  }
  return "bin";
}

function normalizeText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

export async function createStoryText(params: { userId: string; text: string }) {
  const supabase = getSupabaseClient();
  const text = normalizeText(params.text);
  if (!text) {
    throw new Error("Story de texto vazia.");
  }

  const { data, error } = await supabase
    .from("chat_stories")
    .insert({
      user_id: params.userId,
      type: "text",
      text,
    })
    .select("id, user_id, type, text, media_path, media_type, created_at, expires_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Falha ao publicar story de texto.");
  }

  return data as ChatStory;
}

export async function createStoryMedia(params: { userId: string; file: File; optionalText?: string }) {
  const supabase = getSupabaseClient();
  const text = normalizeText(params.optionalText);
  const initialType: StoryType = text ? "mixed" : "media";

  const storyResult = await supabase
    .from("chat_stories")
    .insert({
      user_id: params.userId,
      type: initialType,
      text,
    })
    .select("id, user_id, type, text, media_path, media_type, created_at, expires_at")
    .single();

  if (storyResult.error || !storyResult.data) {
    throw new Error(storyResult.error?.message || "Falha ao iniciar publicacao de story.");
  }

  const story = storyResult.data as ChatStory;
  const ext = extFromFile(params.file);
  const mediaPath = `${params.userId}/${story.id}-${Date.now()}.${ext}`;

  const uploadResult = await supabase.storage
    .from(STORY_BUCKET)
    .upload(mediaPath, params.file, { upsert: false, contentType: params.file.type || undefined });

  if (uploadResult.error) {
    await supabase.from("chat_stories").delete().eq("id", story.id);
    throw new Error(uploadResult.error.message || "Falha ao enviar midia do story.");
  }

  const finalResult = await supabase
    .from("chat_stories")
    .update({
      media_path: mediaPath,
      media_type: params.file.type || null,
      type: initialType,
      text,
    })
    .eq("id", story.id)
    .select("id, user_id, type, text, media_path, media_type, created_at, expires_at")
    .single();

  if (finalResult.error || !finalResult.data) {
    throw new Error(finalResult.error?.message || "Falha ao concluir publicacao de story.");
  }

  return finalResult.data as ChatStory;
}

export async function listActiveStoriesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return [] as ChatStory[];
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_stories")
    .select("id, user_id, type, text, media_path, media_type, created_at, expires_at")
    .in("user_id", userIds)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Falha ao buscar stories ativas.");
  }

  const rows = (data ?? []) as ChatStory[];
  const latestByUser = new Map<string, ChatStory>();
  for (const row of rows) {
    if (!latestByUser.has(row.user_id)) {
      latestByUser.set(row.user_id, row);
    }
  }
  return [...latestByUser.values()];
}

export async function listActiveStoriesForUser(userId: string) {
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_stories")
    .select("id, user_id, type, text, media_path, media_type, created_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Falha ao carregar stories do usuario.");
  }

  return (data ?? []) as ChatStory[];
}

export async function getStoryMediaUrl(mediaPath: string) {
  const now = Date.now();
  const cached = signedUrlCache.get(mediaPath);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(STORY_BUCKET)
    .createSignedUrl(mediaPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Falha ao gerar URL de story.");
  }

  signedUrlCache.set(mediaPath, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_CACHE_MS,
  });

  return data.signedUrl;
}

export async function deleteStory(params: { storyId: string; mediaPath?: string | null }) {
  const supabase = getSupabaseClient();

  if (params.mediaPath) {
    const storageResult = await supabase.storage.from(STORY_BUCKET).remove([params.mediaPath]);
    if (storageResult.error) {
      throw new Error(storageResult.error.message || "Falha ao remover midia do story.");
    }
    signedUrlCache.delete(params.mediaPath);
  }

  const { error } = await supabase.from("chat_stories").delete().eq("id", params.storyId);
  if (error) {
    throw new Error(error.message || "Falha ao apagar story.");
  }
}
