import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ModuleId } from "../core/modules/types";
import { moduleRegistryById } from "../core/modules/registry";
import { useLayoutStore } from "../core/workspace/layoutStore";
import { isTauri } from "../core/platform/isTauri";
import { tauriEmit } from "../core/platform/tauriEvents";

export function WidgetWindow() {
  const [params] = useSearchParams();
  const widgetId = params.get("widgetId") ?? "";
  const moduleIdParam = params.get("moduleId") as ModuleId | null;
  const widget = useLayoutStore((state) => state.widgets.find((entry) => entry.id === widgetId));
  const effectiveModuleId = widget?.moduleId ?? moduleIdParam;

  const ModuleComponent = useMemo(() => {
    if (!effectiveModuleId) return null;
    return moduleRegistryById[effectiveModuleId]?.component ?? null;
  }, [effectiveModuleId]);

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
    await tauriEmit("mm:attach_widget", { widgetId });
    await closeCurrentWindow();
  };

  const closeFromWindow = async () => {
    if (!widgetId || !isTauri) return;
    await tauriEmit("mm:close_widget", { widgetId });
    await closeCurrentWindow();
  };

  if (!effectiveModuleId || !ModuleComponent) {
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
          <span>{moduleRegistryById[effectiveModuleId].title}</span>
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
