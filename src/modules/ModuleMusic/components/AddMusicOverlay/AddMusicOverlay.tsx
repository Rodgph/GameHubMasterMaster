import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { cloudApiFetch } from "../../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../../core/services/supabase";
import { useMusicStore } from "../../musicStore";
import "./AddMusicOverlay.css";

type AddMusicOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type AddMusicOverlayRoute = "menu" | "artist" | "album" | "track";

type ArtistOption = {
  id: string;
  name: string;
  slug: string;
  avatarKey: string | null;
  coverKey: string | null;
  createdAt: string;
};

type AlbumOption = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  coverKey: string | null;
  releaseDate: string | null;
  kind: "single" | "ep" | "album";
  createdAt: string;
};

type GenreOption = {
  id: string;
  name: string;
  slug: string;
};

type SelectedArtist = {
  id: string | null;
  name: string;
  isCustom: boolean;
};

type SelectedGenre = {
  id: string | null;
  name: string;
  slug: string | null;
  isCustom: boolean;
};

type SearchArtistsResponse = {
  artists: ArtistOption[];
};

type SearchAlbumsResponse = {
  albums: AlbumOption[];
};

type GenresResponse = {
  genres: GenreOption[];
};

type CreateArtistResponse = {
  artist: {
    id: string;
    name: string;
    slug: string;
    avatarKey: string | null;
    coverKey: string | null;
    createdAt: string;
  };
};

type CreateGenreResponse = {
  genre: GenreOption;
};

type CreateAlbumResponse = {
  album: {
    id: string;
    artistId: string;
    artistName: string;
    title: string;
    coverKey: string | null;
    releaseDate: string | null;
    kind: "single" | "ep" | "album";
    createdAt: string;
    tracksCount: number;
    likesCount: number;
    genres: GenreOption[];
  };
};

const MENU_CARDS: Array<{
  id: Exclude<AddMusicOverlayRoute, "menu">;
  title: string;
  subtitle: string;
}> = [
  { id: "artist", title: "Criar artista", subtitle: "Nome, slug e capa" },
  { id: "album", title: "Criar album", subtitle: "Titulo, genero e capa" },
  { id: "track", title: "Adicionar faixa", subtitle: "Audio, duracao e ordem" },
];

function normalizeInput(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function sameText(a: string, b: string) {
  return normalizeInput(a).toLowerCase() === normalizeInput(b).toLowerCase();
}

type UploadImageResponse = {
  key: string;
};

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

async function uploadImageToR2(file: File, scope: string) {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);
  const data = await cloudApiFetch<UploadImageResponse>("/music/uploads/image", token, {
    method: "POST",
    body: formData,
  });
  return data.key;
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

type MediaAttachFieldProps = {
  inputId: string;
  file: File | null;
  placeholder: string;
  alt: string;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  disabledFileText?: string;
  disabledPlaceholderText?: string;
};

function MediaAttachField({
  inputId,
  file,
  placeholder,
  alt,
  onFileSelect,
  disabled = false,
  disabledFileText,
  disabledPlaceholderText,
}: MediaAttachFieldProps) {
  const previewUrl = useObjectUrl(file);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const nextFile = event.target.files?.[0] ?? null;
    if (nextFile && !nextFile.type.startsWith("image/")) {
      onFileSelect(null);
      return;
    }
    onFileSelect(nextFile);
  };

  return (
    <div className="music-add-overlay-media-field" data-no-drag="true">
      <input
        id={inputId}
        type="file"
        accept="image/*,.gif"
        className="music-add-overlay-file-input"
        disabled={disabled}
        onChange={handleChange}
      />
      <p className="music-add-overlay-file-name">
        {disabled ? (disabledFileText ?? "Upload indisponivel") : (file ? file.name : "Nenhum arquivo selecionado")}
      </p>
      <label
        htmlFor={inputId}
        className={`music-add-overlay-media-preview music-add-overlay-media-preview-input${
          disabled ? " is-disabled" : ""
        }`}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt={alt} className="music-add-overlay-media-image" />
            <span className="music-add-overlay-preview-cta">Trocar imagem/gif</span>
          </>
        ) : (
          <span className="music-add-overlay-media-placeholder">
            {disabled
              ? (disabledPlaceholderText ?? "Upload bloqueado")
              : `Attach imagem/gif (${placeholder})`}
          </span>
        )}
      </label>
    </div>
  );
}

type SelectionChipProps = {
  label: string;
  onRemove: () => void;
};

function SelectionChip({ label, onRemove }: SelectionChipProps) {
  return (
    <div className="music-add-overlay-chip" data-no-drag="true">
      <span className="music-add-overlay-chip-label">{label}</span>
      <button
        type="button"
        className="music-add-overlay-chip-remove"
        onClick={onRemove}
        aria-label={`Remover ${label}`}
        data-no-drag="true"
      >
        x
      </button>
    </div>
  );
}

function genreChipKey(genre: SelectedGenre) {
  return genre.id ?? `custom:${genre.name.toLowerCase()}`;
}

export function AddMusicOverlay({ open, onClose }: AddMusicOverlayProps) {
  const [route, setRoute] = useState<AddMusicOverlayRoute>("menu");

  const [artistCreateName, setArtistCreateName] = useState("");
  const [artistCreateSlug, setArtistCreateSlug] = useState("");
  const [artistSaving, setArtistSaving] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [artistSuccess, setArtistSuccess] = useState<string | null>(null);
  const [artistCreateMatches, setArtistCreateMatches] = useState<ArtistOption[]>([]);
  const [artistCreateLookupLoading, setArtistCreateLookupLoading] = useState(false);

  const [artistAvatarFile, setArtistAvatarFile] = useState<File | null>(null);
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null);
  const [trackCoverFile, setTrackCoverFile] = useState<File | null>(null);

  const [artistQuery, setArtistQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<SelectedArtist | null>(null);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [artistLoading, setArtistLoading] = useState(false);

  const [albumTitleQuery, setAlbumTitleQuery] = useState("");
  const [selectedAlbumTitle, setSelectedAlbumTitle] = useState<string | null>(null);
  const [albumTitleOptions, setAlbumTitleOptions] = useState<string[]>([]);
  const [albumTitleLoading, setAlbumTitleLoading] = useState(false);

  const [genreQuery, setGenreQuery] = useState("");
  const [availableGenres, setAvailableGenres] = useState<GenreOption[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<SelectedGenre[]>([]);

  const [albumSaving, setAlbumSaving] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumSuccess, setAlbumSuccess] = useState<string | null>(null);

  const activeGenreSlug = useMusicStore((state) => state.activeGenreSlug);
  const loadHome = useMusicStore((state) => state.loadHome);

  useEffect(() => {
    if (open) return;
    setRoute("menu");
    setArtistCreateName("");
    setArtistCreateSlug("");
    setArtistSaving(false);
    setArtistError(null);
    setArtistSuccess(null);
    setArtistCreateMatches([]);
    setArtistCreateLookupLoading(false);

    setArtistAvatarFile(null);
    setAlbumCoverFile(null);
    setTrackCoverFile(null);

    setArtistQuery("");
    setSelectedArtist(null);
    setArtistOptions([]);
    setArtistLoading(false);

    setAlbumTitleQuery("");
    setSelectedAlbumTitle(null);
    setAlbumTitleOptions([]);
    setAlbumTitleLoading(false);

    setGenreQuery("");
    setAvailableGenres([]);
    setGenresLoading(false);
    setSelectedGenres([]);

    setAlbumSaving(false);
    setAlbumError(null);
    setAlbumSuccess(null);
  }, [open]);

  const title = useMemo(() => {
    if (route === "menu") return "Adicionar musica";
    if (route === "artist") return "Rota: Criar artista";
    if (route === "album") return "Rota: Criar album";
    return "Rota: Adicionar faixa";
  }, [route]);

  useEffect(() => {
    if (!open || route !== "artist") return;
    const term = normalizeInput(artistCreateName);
    if (term.length < 2) {
      setArtistCreateMatches([]);
      setArtistCreateLookupLoading(false);
      return;
    }

    let mounted = true;
    setArtistCreateLookupLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          const params = new URLSearchParams();
          params.set("query", term);
          params.set("limit", "8");
          const data = await cloudApiFetch<SearchArtistsResponse>(
            `/music/artists?${params.toString()}`,
            token,
            { method: "GET" },
          );
          if (!mounted) return;
          setArtistCreateMatches(data.artists);
        } catch {
          if (!mounted) return;
          setArtistCreateMatches([]);
        } finally {
          if (!mounted) return;
          setArtistCreateLookupLoading(false);
        }
      })();
    }, 220);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [artistCreateName, open, route]);

  useEffect(() => {
    if (!open || route !== "album") return;
    let mounted = true;

    const run = async () => {
      setGenresLoading(true);
      try {
        const token = await getAccessToken();
        const data = await cloudApiFetch<GenresResponse>("/music/genres", token, { method: "GET" });
        if (!mounted) return;
        setAvailableGenres(data.genres);
      } catch {
        if (!mounted) return;
        setAvailableGenres([]);
      } finally {
        if (!mounted) return;
        setGenresLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [open, route]);

  useEffect(() => {
    if (!open || route !== "album") return;
    if (selectedArtist) {
      setArtistOptions([]);
      setArtistLoading(false);
      return;
    }

    const term = normalizeInput(artistQuery);
    if (!term) {
      setArtistOptions([]);
      setArtistLoading(false);
      return;
    }

    let mounted = true;
    setArtistLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          const params = new URLSearchParams();
          params.set("query", term);
          params.set("limit", "8");
          const data = await cloudApiFetch<SearchArtistsResponse>(
            `/music/artists?${params.toString()}`,
            token,
            { method: "GET" },
          );
          if (!mounted) return;
          setArtistOptions(data.artists);
        } catch {
          if (!mounted) return;
          setArtistOptions([]);
        } finally {
          if (!mounted) return;
          setArtistLoading(false);
        }
      })();
    }, 220);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [artistQuery, open, route, selectedArtist]);

  useEffect(() => {
    if (!open || route !== "album") return;
    if (selectedAlbumTitle) {
      setAlbumTitleOptions([]);
      setAlbumTitleLoading(false);
      return;
    }

    const term = normalizeInput(albumTitleQuery);
    if (!term) {
      setAlbumTitleOptions([]);
      setAlbumTitleLoading(false);
      return;
    }

    let mounted = true;
    setAlbumTitleLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          const params = new URLSearchParams();
          params.set("query", term);
          params.set("limit", "8");
          if (selectedArtist?.id) params.set("artistId", selectedArtist.id);

          const data = await cloudApiFetch<SearchAlbumsResponse>(
            `/music/albums?${params.toString()}`,
            token,
            { method: "GET" },
          );

          const uniqueTitles = Array.from(
            new Map(
              data.albums.map((album) => [normalizeInput(album.title).toLowerCase(), normalizeInput(album.title)]),
            ).values(),
          );

          if (!mounted) return;
          setAlbumTitleOptions(uniqueTitles);
        } catch {
          if (!mounted) return;
          setAlbumTitleOptions([]);
        } finally {
          if (!mounted) return;
          setAlbumTitleLoading(false);
        }
      })();
    }, 220);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [albumTitleQuery, open, route, selectedAlbumTitle, selectedArtist?.id]);

  const filteredGenreOptions = useMemo(() => {
    const term = normalizeInput(genreQuery).toLowerCase();
    return availableGenres
      .filter((genre) => {
        const alreadySelected = selectedGenres.some(
          (selected) => selected.id === genre.id || sameText(selected.name, genre.name),
        );
        if (alreadySelected) return false;
        if (!term) return true;

        return (
          genre.name.toLowerCase().includes(term) ||
          genre.slug.toLowerCase().includes(term) ||
          genre.id.toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [availableGenres, genreQuery, selectedGenres]);

  const artistFallbackName = normalizeInput(artistQuery);
  const canUseCustomArtist =
    !selectedArtist &&
    artistFallbackName.length >= 2 &&
    !artistOptions.some((artist) => sameText(artist.name, artistFallbackName));

  const albumTitleFallback = normalizeInput(albumTitleQuery);
  const canUseCustomAlbumTitle =
    !selectedAlbumTitle &&
    albumTitleFallback.length >= 1 &&
    !albumTitleOptions.some((title) => sameText(title, albumTitleFallback));

  const genreFallbackName = normalizeInput(genreQuery);
  const canUseCustomGenre =
    genreFallbackName.length >= 2 &&
    !filteredGenreOptions.some((genre) => sameText(genre.name, genreFallbackName)) &&
    !selectedGenres.some((genre) => sameText(genre.name, genreFallbackName));

  const artistCreateExactMatch = useMemo(() => {
    const name = normalizeInput(artistCreateName);
    if (name.length < 2) return null;
    return artistCreateMatches.find((artist) => sameText(artist.name, name)) ?? null;
  }, [artistCreateMatches, artistCreateName]);

  const artistPhotoLocked = Boolean(artistCreateExactMatch);

  useEffect(() => {
    if (!artistPhotoLocked) return;
    if (!artistAvatarFile) return;
    setArtistAvatarFile(null);
  }, [artistAvatarFile, artistPhotoLocked]);

  const selectArtist = (artist: ArtistOption) => {
    setSelectedArtist({ id: artist.id, name: artist.name, isCustom: false });
    setArtistQuery("");
    setArtistOptions([]);
    setAlbumError(null);
  };

  const selectCustomArtist = (name: string) => {
    const normalized = normalizeInput(name);
    if (!normalized) return;
    setSelectedArtist({ id: null, name: normalized, isCustom: true });
    setArtistQuery("");
    setArtistOptions([]);
    setAlbumError(null);
  };

  const selectAlbumTitle = (titleValue: string) => {
    const normalized = normalizeInput(titleValue);
    if (!normalized) return;
    setSelectedAlbumTitle(normalized);
    setAlbumTitleQuery("");
    setAlbumTitleOptions([]);
    setAlbumError(null);
  };

  const addGenre = (genre: GenreOption) => {
    setSelectedGenres((current) => {
      if (current.some((item) => item.id === genre.id || sameText(item.name, genre.name))) {
        return current;
      }
      return [
        ...current,
        {
          id: genre.id,
          name: genre.name,
          slug: genre.slug,
          isCustom: false,
        },
      ];
    });
    setGenreQuery("");
    setAlbumError(null);
  };

  const addCustomGenre = (name: string) => {
    const normalized = normalizeInput(name);
    if (!normalized) return;
    setSelectedGenres((current) => {
      if (current.some((item) => sameText(item.name, normalized))) {
        return current;
      }
      return [...current, { id: null, name: normalized, slug: null, isCustom: true }];
    });
    setGenreQuery("");
    setAlbumError(null);
  };

  const removeGenre = (target: SelectedGenre) => {
    const targetKey = genreChipKey(target);
    setSelectedGenres((current) => current.filter((item) => genreChipKey(item) !== targetKey));
  };

  const handleArtistInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (artistOptions.length > 0) {
      selectArtist(artistOptions[0]);
      return;
    }

    if (canUseCustomArtist) {
      selectCustomArtist(artistFallbackName);
    }
  };

  const handleAlbumTitleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (albumTitleOptions.length > 0) {
      selectAlbumTitle(albumTitleOptions[0]);
      return;
    }

    if (canUseCustomAlbumTitle) {
      selectAlbumTitle(albumTitleFallback);
    }
  };

  const handleGenreInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (filteredGenreOptions.length > 0) {
      addGenre(filteredGenreOptions[0]);
      return;
    }

    if (canUseCustomGenre) {
      addCustomGenre(genreFallbackName);
    }
  };

  const handleSaveArtist = async () => {
    if (artistSaving) return;
    setArtistError(null);
    setArtistSuccess(null);

    const name = normalizeInput(artistCreateName);
    if (name.length < 2) {
      setArtistError("Digite um nome de artista valido.");
      return;
    }

    const slug = normalizeInput(artistCreateSlug);
    setArtistSaving(true);
    try {
      const token = await getAccessToken();
      const avatarKey =
        !artistPhotoLocked && artistAvatarFile ? await uploadImageToR2(artistAvatarFile, "artist-avatar") : null;
      const data = await cloudApiFetch<CreateArtistResponse>("/music/artists", token, {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          avatarKey,
        }),
      });

      setArtistCreateName(data.artist.name);
      setArtistCreateSlug(data.artist.slug);
      setArtistAvatarFile(null);
      setSelectedArtist({
        id: data.artist.id,
        name: data.artist.name,
        isCustom: false,
      });
      setArtistQuery("");
      setArtistOptions([]);
      setArtistSuccess(`Artista "${data.artist.name}" salvo com sucesso.`);
      void loadHome(activeGenreSlug);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar artista.";
      setArtistError(message);
    } finally {
      setArtistSaving(false);
    }
  };

  const handleSaveAlbum = async () => {
    if (albumSaving) return;
    setAlbumError(null);
    setAlbumSuccess(null);

    const artistCandidate =
      selectedArtist ?? (artistFallbackName ? { id: null, name: artistFallbackName, isCustom: true } : null);
    if (!artistCandidate) {
      setAlbumError("Selecione ou digite o artista.");
      return;
    }

    const titleCandidate = selectedAlbumTitle ?? albumTitleFallback;
    if (!titleCandidate) {
      setAlbumError("Selecione ou digite o titulo do album.");
      return;
    }

    const pendingGenres = [...selectedGenres];
    if (genreFallbackName && !pendingGenres.some((item) => sameText(item.name, genreFallbackName))) {
      pendingGenres.push({ id: null, name: genreFallbackName, slug: null, isCustom: true });
    }

    setAlbumSaving(true);
    try {
      const token = await getAccessToken();

      let artistId = artistCandidate.id;
      if (!artistId) {
        const createdArtist = await cloudApiFetch<CreateArtistResponse>("/music/artists", token, {
          method: "POST",
          body: JSON.stringify({ name: artistCandidate.name }),
        });
        artistId = createdArtist.artist.id;
        setSelectedArtist({
          id: createdArtist.artist.id,
          name: createdArtist.artist.name,
          isCustom: false,
        });
      }

      const resolvedGenreIds: string[] = [];
      const resolvedGenresForUi: SelectedGenre[] = [];

      for (const genre of pendingGenres) {
        if (genre.id) {
          if (!resolvedGenreIds.includes(genre.id)) resolvedGenreIds.push(genre.id);
          resolvedGenresForUi.push(genre);
          continue;
        }

        const createdGenre = await cloudApiFetch<CreateGenreResponse>("/music/genres", token, {
          method: "POST",
          body: JSON.stringify({ name: genre.name }),
        });

        if (!resolvedGenreIds.includes(createdGenre.genre.id)) {
          resolvedGenreIds.push(createdGenre.genre.id);
        }

        resolvedGenresForUi.push({
          id: createdGenre.genre.id,
          name: createdGenre.genre.name,
          slug: createdGenre.genre.slug,
          isCustom: false,
        });
      }

      const coverKey = albumCoverFile ? await uploadImageToR2(albumCoverFile, "album-cover") : null;

      const data = await cloudApiFetch<CreateAlbumResponse>("/music/albums", token, {
        method: "POST",
        body: JSON.stringify({
          artistId,
          title: titleCandidate,
          coverKey,
          kind: "album",
          genreIds: resolvedGenreIds,
        }),
      });

      setSelectedAlbumTitle(data.album.title);
      setSelectedGenres(resolvedGenresForUi);
      setArtistQuery("");
      setAlbumTitleQuery("");
      setGenreQuery("");
      setAlbumSuccess(`Album "${data.album.title}" salvo com sucesso.`);
      void loadHome(activeGenreSlug);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar album.";
      setAlbumError(message);
    } finally {
      setAlbumSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="music-add-overlay-backdrop" data-no-drag="true" onClick={onClose}>
      <section
        className="music-add-overlay-surface"
        data-no-drag="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="music-add-overlay-header" data-no-drag="true">
          <h2 className="music-add-overlay-title">{title}</h2>
          <div className="music-add-overlay-header-actions" data-no-drag="true">
            {route !== "menu" ? (
              <button
                type="button"
                className="music-add-overlay-nav-btn music-add-overlay-btn-70"
                onClick={() => setRoute("menu")}
                data-no-drag="true"
              >
                Voltar
              </button>
            ) : null}
            <button
              type="button"
              className="music-add-overlay-close-btn music-add-overlay-btn-70"
              onClick={onClose}
              data-no-drag="true"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="music-add-overlay-body" data-no-drag="true">
          {route === "menu" ? (
            <>
              {MENU_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="music-add-overlay-card music-add-overlay-btn-70"
                  onClick={() => setRoute(card.id)}
                  data-no-drag="true"
                >
                  <p className="music-add-overlay-card-title">{card.title}</p>
                  <p className="music-add-overlay-card-subtitle">{card.subtitle}</p>
                </button>
              ))}
            </>
          ) : (
            <section className="music-add-overlay-route" data-no-drag="true">
              {route === "artist" ? (
                <>
                  <p className="music-add-overlay-route-subtitle">Preencha os dados basicos do artista.</p>
                  <input
                    className="music-add-overlay-input"
                    placeholder="Nome do artista"
                    value={artistCreateName}
                    onChange={(event) => {
                      setArtistCreateName(event.target.value);
                      setArtistError(null);
                      setArtistSuccess(null);
                    }}
                  />
                  {artistCreateLookupLoading ? <p className="music-add-overlay-helper">Buscando artista...</p> : null}
                  {artistCreateExactMatch ? (
                    <p className="music-add-overlay-helper">
                      Artista ja encontrado. Upload de foto bloqueado nesta tela.
                    </p>
                  ) : null}
                  <input
                    className="music-add-overlay-input"
                    placeholder="Slug (opcional)"
                    value={artistCreateSlug}
                    onChange={(event) => {
                      setArtistCreateSlug(event.target.value);
                      setArtistError(null);
                      setArtistSuccess(null);
                    }}
                  />
                  <MediaAttachField
                    inputId="artist-avatar-attach"
                    file={artistAvatarFile}
                    onFileSelect={setArtistAvatarFile}
                    placeholder="Foto do artista"
                    alt="Foto do artista"
                    disabled={artistPhotoLocked}
                    disabledFileText="Upload bloqueado para artista existente"
                    disabledPlaceholderText="Foto bloqueada para artista ja existente"
                  />
                  {artistError ? <p className="music-add-overlay-feedback is-error">{artistError}</p> : null}
                  {artistSuccess ? <p className="music-add-overlay-feedback is-success">{artistSuccess}</p> : null}
                  <button
                    type="button"
                    className="music-add-overlay-action-btn music-add-overlay-btn-70"
                    onClick={handleSaveArtist}
                    disabled={artistSaving}
                  >
                    {artistSaving ? "Salvando artista..." : "Salvar artista"}
                  </button>
                </>
              ) : null}

              {route === "album" ? (
                <>
                  <p className="music-add-overlay-route-subtitle">Selecione ou crie artista, titulo e genero.</p>

                  <div className="music-add-overlay-field" data-no-drag="true">
                    <input
                      className="music-add-overlay-input"
                      placeholder="ID do artista"
                      value={artistQuery}
                      onChange={(event) => setArtistQuery(event.target.value)}
                      onKeyDown={handleArtistInputKeyDown}
                    />
                    {selectedArtist ? (
                      <div className="music-add-overlay-chip-list" data-no-drag="true">
                        <SelectionChip label={selectedArtist.name} onRemove={() => setSelectedArtist(null)} />
                      </div>
                    ) : null}
                    {!selectedArtist && artistLoading ? (
                      <p className="music-add-overlay-helper">Buscando artista...</p>
                    ) : null}
                    {!selectedArtist && artistOptions.length > 0 ? (
                      <div className="music-add-overlay-suggestions" data-no-drag="true">
                        {artistOptions.map((artist) => (
                          <button
                            key={artist.id}
                            type="button"
                            className="music-add-overlay-suggestion-btn"
                            onClick={() => selectArtist(artist)}
                          >
                            {artist.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!selectedArtist && canUseCustomArtist ? (
                      <button
                        type="button"
                        className="music-add-overlay-suggestion-btn is-custom"
                        onClick={() => selectCustomArtist(artistFallbackName)}
                      >
                        {`Usar "${artistFallbackName}" mesmo nao encontrado`}
                      </button>
                    ) : null}
                  </div>

                  <div className="music-add-overlay-field" data-no-drag="true">
                    <input
                      className="music-add-overlay-input"
                      placeholder="Titulo do album"
                      value={albumTitleQuery}
                      onChange={(event) => setAlbumTitleQuery(event.target.value)}
                      onKeyDown={handleAlbumTitleInputKeyDown}
                    />
                    {selectedAlbumTitle ? (
                      <div className="music-add-overlay-chip-list" data-no-drag="true">
                        <SelectionChip label={selectedAlbumTitle} onRemove={() => setSelectedAlbumTitle(null)} />
                      </div>
                    ) : null}
                    {!selectedAlbumTitle && albumTitleLoading ? (
                      <p className="music-add-overlay-helper">Buscando titulos...</p>
                    ) : null}
                    {!selectedAlbumTitle && albumTitleOptions.length > 0 ? (
                      <div className="music-add-overlay-suggestions" data-no-drag="true">
                        {albumTitleOptions.map((albumTitle) => (
                          <button
                            key={albumTitle}
                            type="button"
                            className="music-add-overlay-suggestion-btn"
                            onClick={() => selectAlbumTitle(albumTitle)}
                          >
                            {albumTitle}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!selectedAlbumTitle && canUseCustomAlbumTitle ? (
                      <button
                        type="button"
                        className="music-add-overlay-suggestion-btn is-custom"
                        onClick={() => selectAlbumTitle(albumTitleFallback)}
                      >
                        {`Usar "${albumTitleFallback}" mesmo nao encontrado`}
                      </button>
                    ) : null}
                  </div>

                  <div className="music-add-overlay-field" data-no-drag="true">
                    <input
                      className="music-add-overlay-input"
                      placeholder="Genero (id ou slug)"
                      value={genreQuery}
                      onChange={(event) => setGenreQuery(event.target.value)}
                      onKeyDown={handleGenreInputKeyDown}
                    />
                    {selectedGenres.length > 0 ? (
                      <div className="music-add-overlay-chip-list" data-no-drag="true">
                        {selectedGenres.map((genre) => (
                          <SelectionChip key={genreChipKey(genre)} label={genre.name} onRemove={() => removeGenre(genre)} />
                        ))}
                      </div>
                    ) : null}
                    {genresLoading ? <p className="music-add-overlay-helper">Carregando generos...</p> : null}
                    {filteredGenreOptions.length > 0 ? (
                      <div className="music-add-overlay-suggestions" data-no-drag="true">
                        {filteredGenreOptions.map((genre) => (
                          <button
                            key={genre.id}
                            type="button"
                            className="music-add-overlay-suggestion-btn"
                            onClick={() => addGenre(genre)}
                          >
                            {genre.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {canUseCustomGenre ? (
                      <button
                        type="button"
                        className="music-add-overlay-suggestion-btn is-custom"
                        onClick={() => addCustomGenre(genreFallbackName)}
                      >
                        {`Usar "${genreFallbackName}" mesmo nao encontrado`}
                      </button>
                    ) : null}
                  </div>

                  <MediaAttachField
                    inputId="album-cover-attach"
                    file={albumCoverFile}
                    onFileSelect={setAlbumCoverFile}
                    placeholder="Capa do album"
                    alt="Capa do album"
                  />

                  {albumError ? <p className="music-add-overlay-feedback is-error">{albumError}</p> : null}
                  {albumSuccess ? <p className="music-add-overlay-feedback is-success">{albumSuccess}</p> : null}

                  <button
                    type="button"
                    className="music-add-overlay-action-btn music-add-overlay-btn-70"
                    onClick={handleSaveAlbum}
                    disabled={albumSaving}
                  >
                    {albumSaving ? "Salvando album..." : "Salvar album"}
                  </button>
                </>
              ) : null}

              {route === "track" ? (
                <>
                  <p className="music-add-overlay-route-subtitle">Adicione a faixa vinculando ao album.</p>
                  <input className="music-add-overlay-input" placeholder="ID do album" />
                  <input className="music-add-overlay-input" placeholder="Titulo da faixa" />
                  <input className="music-add-overlay-input" placeholder="Chave do audio (R2)" />
                  <MediaAttachField
                    inputId="track-cover-attach"
                    file={trackCoverFile}
                    onFileSelect={setTrackCoverFile}
                    placeholder="Capa da faixa"
                    alt="Capa da faixa"
                  />
                  <button type="button" className="music-add-overlay-action-btn music-add-overlay-btn-70">
                    Salvar faixa
                  </button>
                </>
              ) : null}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
