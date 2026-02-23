import { useEffect, useMemo, useRef, useState } from "react";
import { BaseIconButton, CurrentUserName } from "../../shared/ui";
import { FiPlus, FiSearch } from "../../shared/ui/icons";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeFilter = useMusicStore((state) => state.activeFilter);
  const openAddMusicOverlay = useMusicStore((state) => state.openAddMusicOverlay);
  const setActiveFilter = useMusicStore((state) => state.setActiveFilter);
  const timePeriod = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      setSearchOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [searchOpen]);

  return (
    <header ref={rootRef} className="music-header" data-no-drag="true">
      <div className="music-header-row music-header-row-top" data-no-drag="true">
        <CurrentUserName
          className={`music-header-greeting${searchOpen ? " is-hidden" : ""}`}
          prefix="hey "
        />

        <div className={`music-header-search${searchOpen ? " is-open" : ""}`} data-no-drag="true">
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            placeholder="Pesquisar..."
            className="base-pill-input music-header-search-input"
            tabIndex={searchOpen ? 0 : -1}
            onChange={(event) => setSearchValue(event.target.value)}
            data-no-drag="true"
          />
        </div>

        <div className="music-header-actions" data-no-drag="true">
          <BaseIconButton aria-label="Search" onClick={() => setSearchOpen((value) => !value)}>
            <FiSearch size={17} />
          </BaseIconButton>
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
