import { useMemo } from "react";
import { BaseIconButton, CurrentUserName } from "../../shared/ui";
import { FiPlus } from "../../shared/ui/icons";
import { type MusicFilter, useMusicStore } from "./musicStore";
import "./ModuleHeader.css";

const HEADER_FILTERS: Array<{ id: MusicFilter; label: string }> = [
  { id: "home", label: "Home" },
  { id: "library", label: "Library" },
  { id: "liked", label: "Liked" },
  { id: "folders", label: "Folders" },
  { id: "history", label: "History" },
];

export function ModuleHeader() {
  const activeFilter = useMusicStore((state) => state.activeFilter);
  const openAddMusicOverlay = useMusicStore((state) => state.openAddMusicOverlay);
  const setActiveFilter = useMusicStore((state) => state.setActiveFilter);
  const timePeriod = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }, []);

  return (
    <header className="music-header" data-no-drag="true">
      <div className="music-header-row music-header-row-top" data-no-drag="true">
        <CurrentUserName className="music-header-greeting" prefix="hey " />

        <div className="music-header-actions" data-no-drag="true">
          <BaseIconButton aria-label="Adicionar musica" onClick={openAddMusicOverlay}>
            <FiPlus size={17} />
          </BaseIconButton>
        </div>
      </div>

      <div className="music-header-row" data-no-drag="true">
        <p className="music-header-subtitle">{`Good ${timePeriod}, what would you like to hear`}</p>
      </div>

      <div className="music-header-row music-header-filters" data-no-drag="true">
        {HEADER_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`music-header-filter-btn${activeFilter === filter.id ? " is-active" : ""}`}
            onClick={() => setActiveFilter(filter.id)}
            data-no-drag="true"
          >
            {filter.label}
          </button>
        ))}
      </div>
    </header>
  );
}
