import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { moduleRegistryById } from "../core/modules/registry";
import { useLayoutStore } from "../core/workspace/layoutStore";
import { isTauri } from "../core/platform/isTauri";

export function WidgetWindow() {
  const [params] = useSearchParams();
  const widgetId = params.get("widgetId") ?? "";
  const widget = useLayoutStore((state) => state.widgets.find((entry) => entry.id === widgetId));

  const ModuleComponent = useMemo(() => {
    if (!widget) return null;
    return moduleRegistryById[widget.moduleId].component;
  }, [widget]);

  const closeSelf = async () => {
    if (!isTauri) return;
    await getCurrentWebviewWindow().close();
  };

  const attachToDock = async () => {
    if (!widgetId || !isTauri) return;
    await emit("mm:attach_widget", { widgetId });
    await getCurrentWebviewWindow().close();
  };

  const closeFromWindow = async () => {
    if (!widgetId || !isTauri) return;
    await emit("mm:close_widget", { widgetId });
    await getCurrentWebviewWindow().close();
  };

  if (!widget || !ModuleComponent) {
    return (
      <main className="widget-window-page">
        <section className="widget-window-card">Widget nao encontrado.</section>
      </main>
    );
  }

  return (
    <main className="widget-window-page">
      <section className="widget-window-card">
        <header className="widget-window-header">
          <span>{moduleRegistryById[widget.moduleId].title}</span>
          <div className="widget-window-actions">
            <button type="button" onClick={attachToDock}>
              Dock
            </button>
            <button type="button" onClick={closeFromWindow}>
              Fechar
            </button>
          </div>
        </header>
        <section className="widget-window-content">
          <ModuleComponent />
        </section>
      </section>
      {!isTauri ? (
        <button type="button" className="widget-window-close" onClick={closeSelf}>
          Voltar
        </button>
      ) : null}
    </main>
  );
}
