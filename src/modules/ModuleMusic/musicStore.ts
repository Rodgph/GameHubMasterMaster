import { create } from "zustand";
import { cloudApiFetch } from "../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../core/services/supabase";
import { listMusicHistory, upsertMusicHistory } from "../../infra/localdb/musicHistoryRepo";

export type MusicGenre = {
  id: string;
  name: string;
  slug: string;
};

export type MusicRecentlyListenedItem = {
  trackId: string;
  title: string;
  durationSec: number | null;
  albumId: string;
  albumTitle: string;
  albumCoverKey: string | null;
  artistId: string;
  artist: string;
  listenedAt: string;
};

export type MusicFeaturedAlbum = {
  id: string;
  artistId: string;
  artist: string;
  title: string;
  coverKey: string | null;
  releaseDate: string | null;
  kind: "single" | "ep" | "album";
};

export type MusicHistoryItem = {
  trackId: string;
  title: string;
  artist: string;
  albumId: string;
  albumTitle: string;
  albumCoverKey: string | null;
  listenedAt: number;
};

export type MusicFilter = "home" | "library" | "liked" | "folders" | "history";

type MusicHomeResponse = {
  genres: MusicGenre[];
  recentlyListened: MusicRecentlyListenedItem[];
  featuredAlbums: MusicFeaturedAlbum[];
};

type MusicStore = {
  genres: MusicGenre[];
  recentlyListened: MusicRecentlyListenedItem[];
  featuredAlbums: MusicFeaturedAlbum[];
  historyItems: MusicHistoryItem[];
  addMusicOverlayOpen: boolean;
  activeFilter: MusicFilter;
  activeGenreSlug: string | null;
  loadingHome: boolean;
  loadingHistory: boolean;
  errorText: string | null;
  openAddMusicOverlay: () => void;
  closeAddMusicOverlay: () => void;
  setActiveFilter: (filter: MusicFilter) => void;
  setActiveGenreSlug: (slug: string | null) => void;
  loadHistory: (userId: string) => Promise<void>;
  registerTrackHistory: (userId: string, item: MusicRecentlyListenedItem) => Promise<void>;
  markTrackListened: (trackId: string) => Promise<void>;
  loadHome: (genreSlug?: string | null) => Promise<void>;
};

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao invalida.");
  return token;
}

export const useMusicStore = create<MusicStore>((set) => ({
  genres: [],
  recentlyListened: [],
  featuredAlbums: [],
  historyItems: [],
  addMusicOverlayOpen: false,
  activeFilter: "home",
  activeGenreSlug: null,
  loadingHome: false,
  loadingHistory: false,
  errorText: null,
  openAddMusicOverlay: () => set({ addMusicOverlayOpen: true }),
  closeAddMusicOverlay: () => set({ addMusicOverlayOpen: false }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setActiveGenreSlug: (slug) => set({ activeGenreSlug: slug }),
  loadHistory: async (userId) => {
    set({ loadingHistory: true, errorText: null });
    try {
      const rows = await listMusicHistory(userId, 80);
      set({
        historyItems: rows.map((item) => ({
          trackId: item.trackId,
          title: item.title,
          artist: item.artist,
          albumId: item.albumId,
          albumTitle: item.albumTitle,
          albumCoverKey: item.albumCoverKey,
          listenedAt: item.listenedAt,
        })),
        loadingHistory: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar historico";
      set({
        loadingHistory: false,
        errorText: message,
      });
    }
  },
  registerTrackHistory: async (userId, item) => {
    try {
      await upsertMusicHistory({
        userId,
        trackId: item.trackId,
        title: item.title,
        artist: item.artist,
        albumId: item.albumId,
        albumTitle: item.albumTitle,
        albumCoverKey: item.albumCoverKey,
        listenedAt: Date.now(),
      });
      const rows = await listMusicHistory(userId, 80);
      set({
        historyItems: rows.map((row) => ({
          trackId: row.trackId,
          title: row.title,
          artist: row.artist,
          albumId: row.albumId,
          albumTitle: row.albumTitle,
          albumCoverKey: row.albumCoverKey,
          listenedAt: row.listenedAt,
        })),
      });
    } catch {
      // historico local falhou, nao bloqueia a experiencia
    }
  },
  markTrackListened: async (trackId) => {
    try {
      const token = await getAccessToken();
      await cloudApiFetch(`/music/tracks/${encodeURIComponent(trackId)}/listen`, token, {
        method: "POST",
      });
    } catch {
      // falha de rede nao deve quebrar a UI
    }
  },
  loadHome: async (genreSlug) => {
    set({ loadingHome: true, errorText: null });

    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      params.set("limit", "12");
      if (genreSlug) params.set("genre", genreSlug);

      const path = `/music/home?${params.toString()}`;
      const data = await cloudApiFetch<MusicHomeResponse>(path, token, { method: "GET" });

      set({
        genres: data.genres,
        recentlyListened: data.recentlyListened,
        featuredAlbums: data.featuredAlbums,
        loadingHome: false,
        errorText: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar musica";
      set({
        loadingHome: false,
        errorText: message,
      });
    }
  },
}));
