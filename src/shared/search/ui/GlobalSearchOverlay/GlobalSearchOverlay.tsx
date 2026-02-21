import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../../../core/stores/sessionStore";
import { createSearchEngine } from "../../engine/searchEngine";
import { createActionsProvider } from "../../engine/providers/actionsProvider";
import { createRoutesProvider } from "../../engine/providers/routesProvider";
import { createUsersProvider } from "../../engine/providers/usersProvider";
import type { SearchResult } from "../../engine/types";
import { SearchResultItem } from "../SearchResultItem/SearchResultItem";
import "./GlobalSearchOverlay.css";

export function GlobalSearchOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useSessionStore((state) => state.logout);
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const engine = useMemo(
    () =>
      createSearchEngine([
        createUsersProvider({
          onOpenUser: (userId) => navigate(`/chat/u/${userId}`),
          currentUserId,
        }),
        createRoutesProvider({
          onNavigate: (path) => navigate(path),
        }),
        createActionsProvider({
          onLogout: async () => {
            await logout();
            navigate("/login", { replace: true });
          },
        }),
      ]),
    [currentUserId, logout, navigate],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isToggle) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (!isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      return;
    }

    let cancelled = false;
    void engine.search(debouncedQuery).then((next) => {
      if (cancelled) return;
      setResults(next);
      setActiveIndex(0);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, engine, isOpen]);

  const executeSelection = async (index: number) => {
    const target = results[index];
    if (!target?.onSelect) return;
    await target.onSelect();
    setIsOpen(false);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void executeSelection(activeIndex);
    }
  };

  return (
    <div className={`global-search-overlay${isOpen ? " is-open" : ""}`} data-no-drag="true">
      <div className="global-search-backdrop" onClick={() => setIsOpen(false)} />
      <section className="global-search-shell">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          className="global-search-input"
          placeholder="Pesquisar... (use @ para usuarios)"
          data-no-drag="true"
        />

        <div className="global-search-results" data-no-drag="true">
          {results.length === 0 ? (
            <div className="global-search-empty">Nenhum resultado encontrado</div>
          ) : (
            results.map((item, index) => (
              <SearchResultItem
                key={item.id}
                item={item}
                active={index === activeIndex}
                onSelect={() => {
                  setActiveIndex(index);
                  void executeSelection(index);
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
