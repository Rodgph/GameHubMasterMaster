import { cloudChatCreateRoom } from "../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../core/services/supabase";

const GROUP_BUCKET = "chat-groups";
const GROUP_SCHEDULED_STORAGE_KEY = "chat_group_scheduled_v1";
const SIGNED_TTL_SECONDS = 60 * 60;
const SIGNED_CACHE_MS = 5 * 60 * 1000;

type GroupImageSignedCache = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, GroupImageSignedCache>();

export type GroupRow = {
  id: string;
  room_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  created_at: string;
};

export type GroupView = GroupRow & {
  image_url?: string | null;
};

function extFromFile(file: File) {
  const dot = file.name.lastIndexOf(".");
  if (dot > -1 && dot < file.name.length - 1) {
    return file.name.slice(dot + 1).toLowerCase();
  }
  const parts = file.type.split("/");
  if (parts.length > 1) return parts[1].toLowerCase();
  return "bin";
}

function loadScheduledGroups() {
  try {
    const raw = window.localStorage.getItem(GROUP_SCHEDULED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}

function saveScheduledGroups(next: unknown[]) {
  window.localStorage.setItem(GROUP_SCHEDULED_STORAGE_KEY, JSON.stringify(next));
}

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

export async function getGroupImageUrl(imagePath: string) {
  const cached = signedUrlCache.get(imagePath);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.url;

  const supabase = getSupabaseClient();
  const signed = await supabase.storage.from(GROUP_BUCKET).createSignedUrl(imagePath, SIGNED_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || "Falha ao gerar URL da imagem do grupo.");
  }
  signedUrlCache.set(imagePath, {
    url: signed.data.signedUrl,
    expiresAt: now + SIGNED_CACHE_MS,
  });
  return signed.data.signedUrl;
}

export async function getGroupByRoomId(roomId: string): Promise<GroupView | null> {
  const supabase = getSupabaseClient();
  const group = await supabase
    .from("chat_groups")
    .select("id, room_id, owner_id, name, description, image_path, created_at")
    .eq("room_id", roomId)
    .maybeSingle();

  if (group.error) {
    throw new Error(group.error.message || "Falha ao buscar grupo.");
  }
  if (!group.data) return null;

  const row = group.data as GroupRow;
  if (!row.image_path) return { ...row, image_url: null };
  try {
    const url = await getGroupImageUrl(row.image_path);
    return { ...row, image_url: url };
  } catch {
    return { ...row, image_url: null };
  }
}

export async function isUserMember(roomId: string, userId: string) {
  const supabase = getSupabaseClient();
  const group = await supabase.from("chat_groups").select("id").eq("room_id", roomId).maybeSingle();
  if (group.error || !group.data) return false;
  const check = await supabase
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", group.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(check.data) && !check.error;
}

export async function createGroupRoom(params: {
  ownerId: string;
  name: string;
  description?: string;
  memberIds: string[];
  imageFile?: File | null;
  scheduleAt?: string;
}) {
  const trimmedName = params.name.trim();
  if (!trimmedName) throw new Error("Nome do grupo obrigatorio.");

  if (params.scheduleAt) {
    const supabase = getSupabaseClient();
    const payload = {
      name: trimmedName,
      description: params.description ?? "",
      memberIds: [...new Set(params.memberIds)],
    };

    const insertSchedule = await supabase.from("chat_group_schedules").insert({
      owner_id: params.ownerId,
      schedule_at: params.scheduleAt,
      payload,
      status: "scheduled",
    });

    if (insertSchedule.error) {
      // fallback local placeholder if schedule table isn't ready in remote env
      const scheduled = loadScheduledGroups();
      scheduled.push({
        id: crypto.randomUUID(),
        ownerId: params.ownerId,
        scheduleAt: params.scheduleAt,
        payload,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
      saveScheduledGroups(scheduled);
    }

    return { roomId: null as string | null, status: "scheduled" as const };
  }

  const token = await getAccessToken();
  const members = [...new Set([params.ownerId, ...params.memberIds])];
  const createdRoom = await cloudChatCreateRoom(token, {
    title: trimmedName,
    memberIds: members.filter((id) => id !== params.ownerId),
  });

  const supabase = getSupabaseClient();
  const insertGroup = await supabase
    .from("chat_groups")
    .insert({
      room_id: createdRoom.roomId,
      owner_id: params.ownerId,
      name: trimmedName,
      description: params.description ?? null,
    })
    .select("id, room_id, owner_id, name, description, image_path, created_at")
    .single();

  if (insertGroup.error || !insertGroup.data) {
    throw new Error(insertGroup.error?.message || "Falha ao salvar grupo.");
  }

  const group = insertGroup.data as GroupRow;
  const insertMembers = await supabase.from("chat_group_members").insert(
    members.map((userId) => ({
      group_id: group.id,
      user_id: userId,
      role: userId === params.ownerId ? "owner" : "member",
    })),
  );
  if (insertMembers.error) {
    throw new Error(insertMembers.error.message || "Falha ao salvar membros do grupo.");
  }

  if (params.imageFile) {
    const ext = extFromFile(params.imageFile);
    const imagePath = `${params.ownerId}/${group.id}/avatar-${Date.now()}.${ext}`;

    const uploadImage = await supabase.storage
      .from(GROUP_BUCKET)
      .upload(imagePath, params.imageFile, {
        upsert: false,
        contentType: params.imageFile.type || undefined,
      });

    if (uploadImage.error) {
      throw new Error(uploadImage.error.message || "Falha ao enviar imagem do grupo.");
    }

    const updateGroup = await supabase
      .from("chat_groups")
      .update({ image_path: imagePath })
      .eq("id", group.id);
    if (updateGroup.error) {
      throw new Error(updateGroup.error.message || "Falha ao salvar imagem do grupo.");
    }
  }

  return { roomId: createdRoom.roomId, status: "created" as const };
}
