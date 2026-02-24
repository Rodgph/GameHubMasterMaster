import { useEffect, useMemo } from "react";
import { APP_SHORTCUTS, isShortcutPressed } from "../../../core/shortcuts/appShortcuts";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { useWorkspaceSearchStore } from "../../../core/workspace/searchStore";
import { AddMusicOverlay, ModuleFooter, ModuleHeader } from "../components";
import { useMusicStore } from "../musicStore";

const MOCK_GENRES = [
  { id: "mock-exp-pop", name: "exp pop", slug: "exp-pop" },
  { id: "mock-hip-hop", name: "hip hop", slug: "hip-hop" },
  { id: "mock-funk", name: "funk", slug: "funk" },
  { id: "mock-rage", name: "rage", slug: "rage" },
  { id: "mock-plug", name: "plug", slug: "plug" },
  { id: "mock-drill", name: "drill", slug: "drill" },
];

const MOCK_RECENTLY_LISTENED = [
  {
    trackId: "1",
    title: "kunk de 50",
    artist: "Bullet",
    albumCoverKey: null,
    albumId: "mock-album-1",
    albumTitle: "kunk de 50",
  },
  {
    trackId: "2",
    title: "Noite Neon",
    artist: "Thoney",
    albumCoverKey: null,
    albumId: "mock-album-2",
    albumTitle: "Noite Neon",
  },
  {
    trackId: "3",
    title: "Rua Sem Fim",
    artist: "BlakkClout",
    albumCoverKey: null,
    albumId: "mock-album-3",
    albumTitle: "Rua Sem Fim",
  },
  {
    trackId: "4",
    title: "Zero Gravidade",
    artist: "Zed",
    albumCoverKey: null,
    albumId: "mock-album-4",
    albumTitle: "Zero Gravidade",
  },
];

function toAssetUrl(key: string | null) {
  if (!key) return null;
  const base = (import.meta.env.VITE_MUSIC_ASSETS_BASE_URL as string | undefined)?.trim();
  if (!base) return null;
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedKey}`;
}

export function MusicHomeRoute() {
  const userId = useSessionStore((state) => state.user?.id ?? "");
  const genres = useMusicStore((state) => state.genres);
  const recentlyListened = useMusicStore((state) => state.recentlyListened);
  const historyItems = useMusicStore((state) => state.historyItems);
  const activeFilter = useMusicStore((state) => state.activeFilter);
  const activeGenreSlug = useMusicStore((state) => state.activeGenreSlug);
  const addMusicOverlayOpen = useMusicStore((state) => state.addMusicOverlayOpen);
  const loadingHome = useMusicStore((state) => state.loadingHome);
  const loadingHistory = useMusicStore((state) => state.loadingHistory);
  const closeAddMusicOverlay = useMusicStore((state) => state.closeAddMusicOverlay);
  const setActiveGenreSlug = useMusicStore((state) => state.setActiveGenreSlug);
  const loadHistory = useMusicStore((state) => state.loadHistory);
  const registerTrackHistory = useMusicStore((state) => state.registerTrackHistory);
  const markTrackListened = useMusicStore((state) => state.markTrackListened);
  const loadHome = useMusicStore((state) => state.loadHome);
  const musicSearchQuery = useWorkspaceSearchStore((state) => state.queries.music?.trim().toLowerCase() ?? "");

  useEffect(() => {
    if (activeFilter === "history") return;
    void loadHome(activeGenreSlug);
  }, [activeFilter, activeGenreSlug, loadHome]);

  useEffect(() => {
    if (activeFilter !== "history") return;
    if (!userId) return;
    void loadHistory(userId);
  }, [activeFilter, loadHistory, userId]);

  useEffect(() => {
    if (!addMusicOverlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutPressed(event, APP_SHORTCUTS.CLOSE_OVERLAY)) {
        closeAddMusicOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addMusicOverlayOpen, closeAddMusicOverlay]);

  const genresToRender = genres.length > 0 ? genres : MOCK_GENRES;
  const recentFromApi = recentlyListened.length > 0 ? recentlyListened : MOCK_RECENTLY_LISTENED;
  const recentToRender =
    activeFilter === "history"
      ? historyItems.map((item) => ({
          trackId: item.trackId,
          title: item.title,
          artist: item.artist,
          albumCoverKey: item.albumCoverKey,
          albumId: item.albumId,
          albumTitle: item.albumTitle,
        }))
      : recentFromApi;
  const homeBusy = loadingHome && recentFromApi.length === 0;
  const historyBusy = loadingHistory && historyItems.length === 0;

  const titleByGenre = useMemo(() => {
    if (activeFilter === "history") return "History";
    if (!activeGenreSlug) return "Listined recently";
    const current = genresToRender.find((genre) => genre.slug === activeGenreSlug);
    return current ? `Listined recently in ${current.name}` : "Listined recently";
  }, [activeFilter, activeGenreSlug, genresToRender]);

  const filteredGenresToRender = useMemo(() => {
    if (!musicSearchQuery) return genresToRender;
    return genresToRender.filter((genre) => genre.name.toLowerCase().includes(musicSearchQuery));
  }, [genresToRender, musicSearchQuery]);

  const filteredRecentToRender = useMemo(() => {
    if (!musicSearchQuery) return recentToRender;
    return recentToRender.filter((item) =>
      [item.title, item.artist, item.albumTitle].some((value) => value.toLowerCase().includes(musicSearchQuery)),
    );
  }, [musicSearchQuery, recentToRender]);

  return (
    <section className="music-home-layout" data-no-drag="true">
      <ModuleHeader />
      <div className="music-home-layout-content" data-no-drag="true">
        {activeFilter !== "history" ? (
          <section className="music-home-section" data-no-drag="true">
            <h2 className="music-home-section-title">Genres</h2>
            <div className="music-home-genres-grid" data-no-drag="true">
              {filteredGenresToRender.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  className={`music-home-genre-item${genre.slug === activeGenreSlug ? " is-active" : ""}`}
                  onClick={() => setActiveGenreSlug(genre.slug === activeGenreSlug ? null : genre.slug)}
                  data-no-drag="true"
                >
                  <span>{genre.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="music-home-section" data-no-drag="true">
          <h2 className="music-home-section-title">{titleByGenre}</h2>
          {activeFilter !== "history" && homeBusy ? <p className="music-home-loading">Loading...</p> : null}
          {activeFilter === "history" && historyBusy ? <p className="music-home-loading">Loading...</p> : null}
          <div className="music-home-recent-list" data-no-drag="true">
            {filteredRecentToRender.map((item) => (
              <button
                key={item.trackId}
                type="button"
                className="music-home-recent-item"
                onClick={() => {
                  if (!userId) return;
                  void registerTrackHistory(userId, {
                    trackId: item.trackId,
                    title: item.title,
                    artist: item.artist,
                    albumCoverKey: item.albumCoverKey,
                    albumId: item.albumId,
                    albumTitle: item.albumTitle,
                    durationSec: null,
                    artistId: "",
                    listenedAt: new Date().toISOString(),
                  });
                  void markTrackListened(item.trackId);
                }}
                data-no-drag="true"
              >
                {(() => {
                  const coverUrl = toAssetUrl(item.albumCoverKey);
                  return (
                    <div
                      className="music-home-recent-thumb"
                      style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
                      aria-hidden="true"
                    />
                  );
                })()}
                <div className="music-home-recent-meta" data-no-drag="true">
                  <p className="music-home-recent-title">{item.title}</p>
                  <p className="music-home-recent-artist">{item.artist}</p>
                </div>
              </button>
            ))}
            {activeFilter === "history" && !historyBusy && recentToRender.length === 0 ? (
              <p className="music-home-empty">Seu historico local ainda esta vazio.</p>
            ) : null}
            {musicSearchQuery && !homeBusy && !historyBusy && recentToRender.length > 0 && filteredRecentToRender.length === 0 ? (
              <p className="music-home-empty">Nenhum resultado para a busca.</p>
            ) : null}
          </div>
        </section>
      </div>
      <AddMusicOverlay open={addMusicOverlayOpen} onClose={closeAddMusicOverlay} />
      <ModuleFooter />
    </section>
  );
}
