import { useEffect, useMemo } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { moduleRegistry, moduleRegistryById } from "../modules/registry";
import type { ModuleId } from "../modules/types";
import { useSessionStore } from "../stores/sessionStore";
import { useLayoutStore } from "./layoutStore";
import "./Workspace.css";
import { isTauri } from "../platform/isTauri";
import { tauriListen } from "../platform/tauriEvents";
import { GlobalSearchOverlay } from "../../shared/search/ui/GlobalSearchOverlay/GlobalSearchOverlay";
import { WidgetRuntimeProvider } from "./moduleRuntime";

export function Workspace() {
  const widgets = useLayoutStore((state) => state.widgets);
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

  const addableModulesList = useMemo(
    () => moduleRegistry.filter((module) => module.id !== "welcome"),
    [],
  );

  const visibleWidgets = useMemo(
    () =>
      widgets
        .filter((widget) => !widget.parentId && widget.host !== "tauri")
        .sort((a, b) => a.z - b.z),
    [widgets],
  );

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
              const isNavModule = widget.moduleId === "nav";
              return (
                <article
                  key={widget.id}
                  className={`workspace-module-card ${isNavModule ? "workspace-module-card-nav" : ""}`}
                >
                  {isNavModule ? (
                    <WidgetRuntimeProvider widgetId={widget.id}>
                      <ModuleComponent />
                    </WidgetRuntimeProvider>
                  ) : (
                    <section className="workspace-module-content">
                      <WidgetRuntimeProvider widgetId={widget.id}>
                        <ModuleComponent />
                      </WidgetRuntimeProvider>
                    </section>
                  )}
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
        </ContextMenu.Content>
      </ContextMenu.Portal>
      <GlobalSearchOverlay />
    </ContextMenu.Root>
  );
}
