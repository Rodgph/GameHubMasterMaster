import { useState } from "react";
import { getSupabaseClient } from "../../core/services/supabase";
import { useSessionStore } from "../../core/stores/sessionStore";
import { AvatarCircle } from "../../shared/ui";
import { BsGeoAlt, FaImages, IoMdMusicalNote } from "../../shared/ui/icons";
import { useFeedStore } from "./feedStore";

export function PostComposer() {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addPost = useFeedStore((state) => state.addPost);
  const user = useSessionStore((state) => state.user);

  async function uploadImage(selected: File) {
    if (!user) throw new Error("Usuario nao autenticado.");
    const supabase = getSupabaseClient();
    const extension = selected.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const upload = await supabase.storage.from("feed-images").upload(path, selected, {
      upsert: false,
      contentType: selected.type || "image/jpeg",
    });
    if (upload.error) throw upload.error;

    const publicData = supabase.storage.from("feed-images").getPublicUrl(upload.data.path).data;
    return publicData.publicUrl;
  }

  async function onSubmit() {
    const text = body.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (file) imageUrl = await uploadImage(file);
      await addPost(text, imageUrl);
      setBody("");
      setFile(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="feed-composer" data-no-drag="true">
      <AvatarCircle src={user?.avatar_url ?? undefined} alt={user?.username ?? "user"} size={42} />
      <textarea
        data-no-drag="true"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Compartilhe algo..."
        rows={4}
      />
      <div className="feed-composer-actions">
        <label className="feed-button feed-button-icon" data-no-drag="true" title="Imagem">
          <FaImages size={14} />
          <span>Imagem</span>
          <input
            data-no-drag="true"
            className="feed-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button data-no-drag="true" type="button" className="feed-button feed-button-icon" title="Location">
          <BsGeoAlt size={14} />
          <span>Location</span>
        </button>
        <button data-no-drag="true" type="button" className="feed-button feed-button-icon" title="Music">
          <IoMdMusicalNote size={14} />
          <span>Music</span>
        </button>
        <button data-no-drag="true" type="button" onClick={onSubmit} disabled={isSubmitting}>
          Publicar
        </button>
      </div>
    </div>
  );
}
