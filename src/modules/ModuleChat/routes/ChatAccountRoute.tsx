import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FiRefreshCw, FiSave } from "react-icons/fi";
import { getSupabaseClient } from "../../../core/services/supabase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { BaseActionButton, BasePillInput } from "../../../shared/ui";
import { getChatProfileById, updateMyChatProfile } from "../data/users.repository";

export function ChatAccountRoute() {
  const user = useSessionStore((state) => state.user);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarKind, setAvatarKind] = useState<"image" | "video">("image");
  const [bioText, setBioText] = useState("");
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [okText, setOkText] = useState<string | null>(null);

  const inferAvatarKind = (value: string | null | undefined): "image" | "video" => {
    const text = (value ?? "").trim().toLowerCase();
    if (!text) return "image";
    if (text.startsWith("data:video/")) return "video";
    if (/\.(mp4|webm|ogg|mov)(\?|#|$)/.test(text)) return "video";
    return "image";
  };

  const previewAvatar = useMemo(() => {
    const value = avatarUrl.trim();
    if (!value) return undefined;
    return value;
  }, [avatarUrl]);

  const loadProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    try {
      const profile = await getChatProfileById(user.id);
      setUsername(profile?.username ?? user.username ?? "");
      setAvatarUrl(profile?.avatar_url ?? user.avatar_url ?? "");
      setAvatarKind(inferAvatarKind(profile?.avatar_url ?? user.avatar_url));
      const savedBio = window.localStorage.getItem(`chat_account_bio_${user.id}`);
      setBioText(savedBio ?? "");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Falha ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const loadStats = async () => {
      const supabase = getSupabaseClient();
      const [posts, followers, following] = await Promise.all([
        supabase.from("chat_stories").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("chat_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", user.id),
        supabase.from("chat_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);

      if (!active) return;
      setStats({
        posts: posts.count ?? 0,
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      });
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setAvatarUrl(result);
      setAvatarKind(file.type.startsWith("video/") ? "video" : "image");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setErrorText(null);
    setOkText(null);
    try {
      const updated = await updateMyChatProfile({
        userId: user.id,
        username,
        avatarUrl: avatarUrl.trim() || null,
      });
      useSessionStore.setState((state) => ({
        user: state.user
          ? {
              ...state.user,
              username: updated.username,
              avatar_url: updated.avatar_url,
            }
          : state.user,
      }));
      setUsername(updated.username);
      setAvatarUrl(updated.avatar_url ?? "");
      setAvatarKind(inferAvatarKind(updated.avatar_url));
      window.localStorage.setItem(`chat_account_bio_${user.id}`, bioText);
      setOkText("Perfil atualizado.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="chat-account-route" data-no-drag="true">
      <div className="chat-account-card" data-no-drag="true">
        {loading ? <p className="chat-account-feedback">Carregando...</p> : null}

        <div className="chat-account-media-wrap" data-no-drag="true">
          <button
            type="button"
            className="chat-account-avatar-picker"
            onClick={() => avatarInputRef.current?.click()}
            data-no-drag="true"
          >
            {previewAvatar && avatarKind === "video" ? (
              <video className="chat-account-avatar-media" src={previewAvatar} muted loop autoPlay playsInline />
            ) : previewAvatar ? (
              <img className="chat-account-avatar-media" src={previewAvatar} alt={username || "Avatar"} />
            ) : (
              <div className="chat-account-avatar-empty">Clique para alterar imagem/gif/video</div>
            )}
          </button>
          <BasePillInput
            className="chat-account-username-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="seu_username"
          />
          <input
            ref={avatarInputRef}
            type="file"
            className="chatHiddenFileInput"
            accept="image/*,video/*"
            onChange={(event) => {
              void handleAvatarFileChange(event);
            }}
          />
        </div>

        <div className="chat-account-stats-row" data-no-drag="true">
          <div className="chat-account-stat-pill">{stats.posts} Posts</div>
          <div className="chat-account-stat-pill">{stats.followers} Followers</div>
          <div className="chat-account-stat-pill">{stats.following} Following</div>
        </div>

        <BasePillInput
          className="chat-account-bio-pill"
          value={bioText}
          onChange={(event) => setBioText(event.target.value)}
          placeholder="Escreva sua bio"
        />

        {errorText ? <p className="chat-account-feedback is-error">{errorText}</p> : null}
        {okText ? <p className="chat-account-feedback is-ok">{okText}</p> : null}
        <div className="chat-account-actions" data-no-drag="true">
          <BaseActionButton
            label={saving ? "Salvando..." : "Salvar"}
            icon={<FiSave size={14} />}
            onClick={() => {
              void handleSave();
            }}
          />
          <BaseActionButton
            label="Recarregar"
            icon={<FiRefreshCw size={14} />}
            onClick={() => {
              void loadProfile();
            }}
          />
        </div>
      </div>
    </section>
  );
}
