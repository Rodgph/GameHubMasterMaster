import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ModuleId } from "../core/modules/types";
import { moduleRegistryById } from "../core/modules/registry";
import { useLayoutStore } from "../core/workspace/layoutStore";
import { isTauri } from "../core/platform/isTauri";
import { tauriEmit, tauriListen } from "../core/platform/tauriEvents";
import { WidgetRuntimeProvider } from "../core/workspace/moduleRuntime";
import {
  UniversalContextMenu,
  type ContextMenuItem,
} from "../core/workspace/shells/UniversalContextMenu";
import {
  WINDOW_EVENTS,
  type HydrateWidgetPayload,
  type ReattachWidgetPayload,
  type WidgetClosedPayload,
  type WidgetReadyPayload,
} from "../core/workspace/windowProtocol";

export function WidgetWindow() {
  const [params] = useSearchParams();
  const widgetId = params.get("widgetId") ?? "";
  const moduleIdParam = params.get("moduleId") as ModuleId | null;
  const widget = useLayoutStore((state) => state.widgets.find((entry) => entry.id === widgetId));
  const setWidgetRuntimeState = useLayoutStore((state) => state.setWidgetRuntimeState);
  const setWindowBackgroundMode = useLayoutStore((state) => state.setWindowBackgroundMode);
  const effectiveModuleId = widget?.moduleId ?? moduleIdParam;
  const [hydratedModuleId, setHydratedModuleId] = useState<ModuleId | null>(moduleIdParam);
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });
  const resolvedModuleId = widget?.moduleId ?? hydratedModuleId ?? effectiveModuleId;

  const ModuleComponent = useMemo(() => {
    const moduleId = resolvedModuleId;
    if (!moduleId) return null;
    return moduleRegistryById[moduleId]?.component ?? null;
  }, [resolvedModuleId]);

  const closeCurrentWindow = async () => {
    if (!isTauri) return;
    const mod = await import("@tauri-apps/api/webviewWindow");
    await mod.getCurrentWebviewWindow().close();
  };

  const closeSelf = async () => {
    await closeCurrentWindow();
  };

  const attachToDock = async () => {
    if (!widgetId || !isTauri) return;
    await tauriEmit<ReattachWidgetPayload>(WINDOW_EVENTS.reattachWidget, { widgetId });
    await closeCurrentWindow();
  };

  const closeFromWindow = async () => {
    if (!widgetId || !isTauri) return;
    await tauriEmit<WidgetClosedPayload>(WINDOW_EVENTS.widgetClosed, { widgetId });
    await closeCurrentWindow();
  };

  const menuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        id: "reattach",
        label: "Reanexar ao dock",
        onSelect: () => {
          void attachToDock();
        },
      },
      {
        id: "close",
        label: "Fechar",
        secondary: true,
        onSelect: () => {
          void closeFromWindow();
        },
      },
    ],
    [],
  );

  useEffect(() => {
    if (!widgetId || !isTauri) return;

    void tauriEmit<WidgetReadyPayload>(WINDOW_EVENTS.widgetReady, { widgetId });

    let unlistenHydrate: (() => void) | null = null;
    let unlistenCloseRequested: (() => void) | null = null;
    void tauriListen<HydrateWidgetPayload>(WINDOW_EVENTS.hydrateWidget, (payload) => {
      if (payload.widgetId !== widgetId) return;
      setHydratedModuleId(payload.moduleId);
      setWidgetRuntimeState(widgetId, payload.state);
    }).then((unlisten) => {
      unlistenHydrate = unlisten;
    });

    void import("@tauri-apps/api/webviewWindow").then((mod) => {
      const current = mod.getCurrentWebviewWindow();
      current
        .onCloseRequested(() => {
          void tauriEmit<WidgetClosedPayload>(WINDOW_EVENTS.widgetClosed, { widgetId });
        })
        .then((unlisten) => {
          unlistenCloseRequested = unlisten;
        });
    });

    return () => {
      unlistenHydrate?.();
      unlistenCloseRequested?.();
    };
  }, [setWidgetRuntimeState, widgetId]);

  useEffect(() => {
    const syncGovernor = () => {
      const isBackground = document.hidden || !document.hasFocus();
      if (widgetId) {
        setWindowBackgroundMode(widgetId, isBackground);
      }
      document.body.classList.toggle("app-background", isBackground);
    };

    syncGovernor();
    window.addEventListener("blur", syncGovernor);
    window.addEventListener("focus", syncGovernor);
    document.addEventListener("visibilitychange", syncGovernor);
    return () => {
      window.removeEventListener("blur", syncGovernor);
      window.removeEventListener("focus", syncGovernor);
      document.removeEventListener("visibilitychange", syncGovernor);
    };
  }, [setWindowBackgroundMode, widgetId]);

  if (!resolvedModuleId || !ModuleComponent) {
    return (
      <main className="widget-window-page">
        <section className="widget-window-card">Widget nao encontrado.</section>
      </main>
    );
  }

  return (
    <main className="widget-window-page">
      <section className="widget-window-card">
        <header
          className="widget-window-header"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuState({
              open: true,
              x: event.clientX,
              y: event.clientY,
            });
          }}
        >
          <span>{moduleRegistryById[resolvedModuleId].title}</span>
          <div className="widget-window-actions">
            <button type="button" onClick={attachToDock}>
              Dock
            </button>
            <button type="button" onClick={closeFromWindow}>
              Fechar
            </button>
          </div>
        </header>
        <section
          className="widget-window-content"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuState({
              open: true,
              x: event.clientX,
              y: event.clientY,
            });
          }}
        >
          <WidgetRuntimeProvider widgetId={widgetId}>
            <ModuleComponent />
          </WidgetRuntimeProvider>
        </section>
      </section>
      <UniversalContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuItems}
        onClose={() =>
          setMenuState({
            open: false,
            x: 0,
            y: 0,
          })
        }
      />
      {!isTauri ? (
        <button type="button" className="widget-window-close" onClick={closeSelf}>
          Voltar
        </button>
      ) : null}
    </main>
  );
}
