import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { AnimatePresence, motion } from "framer-motion";
import { moduleRegistry, moduleRegistryById } from "../modules/registry";
import type { ModuleId } from "../modules/types";
import { useSessionStore } from "../stores/sessionStore";
import { useLayoutStore } from "./layoutStore";
import "./Workspace.css";
import { isTauri } from "../platform/isTauri";
import { tauriListen } from "../platform/tauriEvents";
import { WidgetRuntimeProvider } from "./moduleRuntime";
import { getWorkspaceSearchPlaceholder, useWorkspaceSearchStore } from "./searchStore";
import { APP_SHORTCUTS, isShortcutPressed } from "../shortcuts/appShortcuts";

export function Workspace() {
  const widgetsById = useLayoutStore((state) => state.widgetsById);
  const widgetOrder = useLayoutStore((state) => state.widgetOrder);
  const addWidget = useLayoutStore((state) => state.addWidget);
  const closeWidget = useLayoutStore((state) => state.closeWidget);
  const closeWidgetWindow = useLayoutStore((state) => state.closeWidgetWindow);
  const resetLayout = useLayoutStore((state) => state.resetLayout);
  const ensureModuleDocked = useLayoutStore((state) => state.ensureModuleDocked);
  const closeWidgetsByModule = useLayoutStore((state) => state.closeWidgetsByModule);

  const sessionReady = useSessionStore((state) => state.sessionReady);
  const user = useSessionStore((state) => state.user);
  const modulesEnabled = useSessionStore((state) => state.modulesEnabled);
  const setModuleEnabled = useSessionStore((state) => state.setModuleEnabled);
  const firstRun = useSessionStore((state) => state.firstRun);

  const searchOpen = useWorkspaceSearchStore((state) => state.isOpen);
  const activeSearchModuleId = useWorkspaceSearchStore((state) => state.activeModuleId);
  const openSearchForModule = useWorkspaceSearchStore((state) => state.openForModule);
  const closeSearch = useWorkspaceSearchStore((state) => state.close);
  const setSearchQuery = useWorkspaceSearchStore((state) => state.setActiveQuery);
  const activeSearchQuery = useWorkspaceSearchStore((state) => {
    if (!state.activeModuleId) return "";
    return state.queries[state.activeModuleId] ?? "";
  });

  const [contextModuleId, setContextModuleId] = useState<ModuleId | null>(null);
  const [activeSearchWidgetId, setActiveSearchWidgetId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchOverlayRef = useRef<HTMLFormElement | null>(null);
  const pointerCoordsRef = useRef({ x: 0, y: 0 });

  const addableModulesList = useMemo(
    () => moduleRegistry.filter((module) => module.id !== "welcome"),
    [],
  );

  const visibleWidgets = useMemo(
    () =>
      widgetOrder
        .map((widgetId) => widgetsById[widgetId])
        .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget))
        .filter((widget) => widget.host !== "tauri"),
    [widgetOrder, widgetsById],
  );

  const resolveSearchTargetFromPointer = useCallback(
    (x: number, y: number): { moduleId: ModuleId | null; widgetId: string | null } => {
      const element = document.elementFromPoint(x, y);
      const moduleCard = element?.closest<HTMLElement>("[data-workspace-module-id]");
      const moduleId = moduleCard?.dataset.workspaceModuleId as ModuleId | undefined;
      const widgetId = moduleCard?.dataset.workspaceWidgetId ?? null;

      if (moduleId && moduleRegistryById[moduleId] && widgetId) {
        return {
          moduleId,
          widgetId,
        };
      }

      const fallback = visibleWidgets[0];
      return {
        moduleId: fallback?.moduleId ?? null,
        widgetId: fallback?.id ?? null,
      };
    },
    [visibleWidgets],
  );

  useEffect(() => {
    pointerCoordsRef.current = {
      x: Math.max(window.innerWidth / 2, 0),
      y: Math.max(window.innerHeight / 2, 0),
    };

    const handleMouseMove = (event: MouseEvent) => {
      pointerCoordsRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isShortcutPressed(event, APP_SHORTCUTS.TOGGLE_GLOBAL_SEARCH)) {
        event.preventDefault();
        event.stopPropagation();
        if (searchOpen) {
          closeSearch();
          return;
        }
        const { x, y } = pointerCoordsRef.current;
        const target = resolveSearchTargetFromPointer(x, y);
        setActiveSearchWidgetId(target.widgetId);
        openSearchForModule(target.moduleId);
        return;
      }

      if (searchOpen && isShortcutPressed(event, APP_SHORTCUTS.CLOSE_OVERLAY)) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSearch, openSearchForModule, resolveSearchTargetFromPointer, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      // Keep search open on context-menu trigger (right click / ctrl+click).
      if (event.button !== 0 || event.ctrlKey) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (searchOverlayRef.current?.contains(target)) return;
      if (activeSearchWidgetId) {
        const activeWidgetElement = document.querySelector<HTMLElement>(
          `[data-workspace-widget-id="${activeSearchWidgetId}"]`,
        );
        if (activeWidgetElement?.contains(target)) return;
      }
      closeSearch();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [activeSearchWidgetId, closeSearch, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const input = searchInputRef.current;
    if (!input) return;

    const rafId = window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [searchOpen, activeSearchModuleId]);

  const handleSearchOverlayExitComplete = useCallback(() => {
    if (!searchOpen) {
      setActiveSearchWidgetId(null);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!isTauri) return;

    let unlistenAttach: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    void tauriListen<{ widgetId: string }>("mm:attach_widget", async (payload) => {
      await closeWidgetWindow(payload.widgetId);
    }).then((unlisten) => {
      unlistenAttach = unlisten;
    });

    void tauriListen<{ widgetId: string }>("mm:close_widget", (payload) => {
      closeWidget(payload.widgetId);
    }).then((unlisten) => {
      unlistenClose = unlisten;
    });

    return () => {
      unlistenAttach?.();
      unlistenClose?.();
    };
  }, [closeWidget, closeWidgetWindow]);

  useEffect(() => {
    if (!sessionReady || !user) return;

    for (const module of moduleRegistry) {
      if (module.id === "welcome") continue;
      if (modulesEnabled[module.id as ModuleId]) {
        ensureModuleDocked(module.id as ModuleId);
      } else {
        closeWidgetsByModule(module.id as ModuleId);
      }
    }

    if (firstRun) {
      ensureModuleDocked("welcome");
    } else {
      closeWidgetsByModule("welcome");
    }
  }, [closeWidgetsByModule, ensureModuleDocked, firstRun, modulesEnabled, sessionReady, user]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <main className="workspace-canvas">
          <section className="workspace-stack">
            {visibleWidgets.map((widget) => {
              const module = moduleRegistryById[widget.moduleId];
              if (!module) return null;
              const ModuleComponent = module.component;
              const isWidgetSearchActive = searchOpen && activeSearchWidgetId === widget.id;

              return (
                <article
                  key={widget.id}
                  className={`workspace-module-card${isWidgetSearchActive ? " is-search-active" : ""}`}
                  data-workspace-module-id={widget.moduleId}
                  data-workspace-widget-id={widget.id}
                  onContextMenu={() => setContextModuleId(widget.moduleId)}
                >
                  {activeSearchWidgetId === widget.id ? (
                    <AnimatePresence onExitComplete={handleSearchOverlayExitComplete}>
                      {searchOpen ? (
                        <motion.form
                          ref={searchOverlayRef}
                          className="workspace-search-overlay"
                          onSubmit={(event) => event.preventDefault()}
                          initial={{ opacity: 0, y: -8, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.985 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <input
                            ref={searchInputRef}
                            className="workspace-search-input"
                            type="text"
                            value={activeSearchQuery}
                            placeholder={getWorkspaceSearchPlaceholder(activeSearchModuleId)}
                            onChange={(event) => setSearchQuery(event.target.value)}
                          />
                        </motion.form>
                      ) : null}
                    </AnimatePresence>
                  ) : null}
                  <WidgetRuntimeProvider widgetId={widget.id}>
                    <ModuleComponent />
                  </WidgetRuntimeProvider>
                </article>
              );
            })}
          </section>
        </main>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="workspace-menu">
          <ContextMenu.Label className="workspace-menu-label">Adicionar modulo</ContextMenu.Label>
          {addableModulesList.map((module) => (
            <ContextMenu.Item
              key={module.id}
              className="workspace-menu-item"
              onSelect={() => {
                const moduleId = module.id as ModuleId;
                if (!modulesEnabled[moduleId]) {
                  setModuleEnabled(moduleId, true);
                  ensureModuleDocked(moduleId);
                  return;
                }
                addWidget(moduleId);
              }}
            >
              {module.title}
            </ContextMenu.Item>
          ))}
          <ContextMenu.Separator className="workspace-menu-separator" />
          <ContextMenu.Item className="workspace-menu-item" onSelect={resetLayout}>
            Reset layout
          </ContextMenu.Item>
          <ContextMenu.Separator className="workspace-menu-separator" />
          <ContextMenu.Item className="workspace-menu-item" onSelect={() => {
            if (contextModuleId) {
              setModuleEnabled(contextModuleId, false);
              closeWidgetsByModule(contextModuleId);
            }
          }}>
            Remover modulo
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
