import { useState } from "react";
import { AvatarCircle } from "../../shared/ui";
import { useSessionStore } from "../../core/stores/sessionStore";
import { BsGeoAlt, FaImages, IoMdAttach, IoMdMusicalNote } from "../../shared/ui/icons";

export function FeedHeader() {
  const user = useSessionStore((state) => state.user);
  const [postText, setPostText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [locationText, setLocationText] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const handleSelectLocation = () => {
    if (!navigator.geolocation) {
      setLocationText("Geolocalizacao indisponivel");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = coords.latitude.toFixed(5);
        const longitude = coords.longitude.toFixed(5);
        setLocationText(`${latitude}, ${longitude}`);
        setIsLocating(false);
      },
      () => {
        setLocationText("Nao foi possivel obter localizacao");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <header className="feed-header" data-no-drag="true">
      <div className="feed-header-row" data-no-drag="true">
        <AvatarCircle src={user?.avatar_url ?? undefined} alt={user?.username ?? "user"} size={40} />
        <input
          type="text"
          className="feed-header-post-input"
          placeholder="what is happening?"
          value={postText}
          onChange={(event) => setPostText(event.target.value)}
          data-no-drag="true"
          aria-label="Escrever post"
        />
        <label className="feed-header-action-btn" data-no-drag="true" title="Selecionar imagem">
          <FaImages size={14} />
          <input
            className="feed-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="feed-header-action-btn" data-no-drag="true" title="Selecionar arquivo">
          <IoMdAttach size={14} />
          <input
            className="feed-file-input"
            type="file"
            onChange={(event) => setAttachFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="feed-header-action-btn" data-no-drag="true" title="Selecionar musica">
          <IoMdMusicalNote size={14} />
          <input
            className="feed-file-input"
            type="file"
            accept="audio/*"
            onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          className="feed-header-action-btn"
          data-no-drag="true"
          title={isLocating ? "Buscando localizacao" : "Selecionar localizacao"}
          onClick={handleSelectLocation}
          disabled={isLocating}
          aria-label="Selecionar localizacao"
        >
          <BsGeoAlt size={14} />
        </button>
      </div>
      {imageFile ? <p className="feed-header-file-hint">{`Imagem: ${imageFile.name}`}</p> : null}
      {attachFile ? <p className="feed-header-file-hint">{`Arquivo: ${attachFile.name}`}</p> : null}
      {musicFile ? <p className="feed-header-file-hint">{`Musica: ${musicFile.name}`}</p> : null}
      {locationText ? <p className="feed-header-file-hint">{`Localizacao: ${locationText}`}</p> : null}
    </header>
  );
}
