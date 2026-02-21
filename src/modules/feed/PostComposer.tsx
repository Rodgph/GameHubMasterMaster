import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../core/services/supabase";
import { useSessionStore } from "../../core/stores/sessionStore";
import { useFeedStore } from "./feedStore";

export function PostComposer() {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addPost = useFeedStore((state) => state.addPost);
  const user = useSessionStore((state) => state.user);

  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

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
    <div className="feed-composer">
      <textarea
        data-no-drag="true"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Compartilhe algo..."
        rows={4}
      />
      {previewUrl ? (
        <img className="feed-composer-preview" src={previewUrl} alt="preview de upload" />
      ) : null}
      <div className="feed-composer-actions">
        <label className="feed-button" data-no-drag="true">
          Imagem
          <input
            data-no-drag="true"
            className="feed-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button data-no-drag="true" type="button" onClick={onSubmit} disabled={isSubmitting}>
          Publicar
        </button>
      </div>
    </div>
  );
}
