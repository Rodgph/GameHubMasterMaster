import { getSupabaseClient } from "../../../core/services/supabase";

const CHAT_MEDIA_BUCKET = "chat-media";
const SIGNED_TTL_SECONDS = 60 * 5;
const SIGNED_CACHE_MS = 60 * 1000;

type SignedCacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, SignedCacheEntry>();

function extFromFile(file: File) {
  const dot = file.name.lastIndexOf(".");
  if (dot > -1 && dot < file.name.length - 1) return file.name.slice(dot + 1).toLowerCase();
  const parts = file.type.split("/");
  if (parts.length > 1) return parts[1].toLowerCase();
  return "bin";
}

export function inferMessageTypeFromFile(file: File): "image" | "audio" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export async function uploadToChatMedia(userId: string, file: File, roomId: string) {
  const supabase = getSupabaseClient();
  const ext = extFromFile(file);
  const path = `${userId}/${roomId}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (upload.error) {
    throw new Error(upload.error.message || "Falha no upload da mídia.");
  }

  return {
    path,
    mime: file.type || null,
    size: file.size ?? null,
  };
}

export async function getSignedUrl(path: string) {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now) return cached.url;

  const supabase = getSupabaseClient();
  const signed = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || "Falha ao gerar URL assinada.");
  }

  signedUrlCache.set(path, {
    url: signed.data.signedUrl,
    expiresAt: now + SIGNED_CACHE_MS,
  });

  return signed.data.signedUrl;
}

