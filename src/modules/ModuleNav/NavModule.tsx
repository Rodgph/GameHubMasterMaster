import { useMemo } from "react";
import { moduleRegistryById } from "../../core/modules/registry";
import { useLayoutStore } from "../../core/workspace/layoutStore";
import { WidgetRuntimeProvider, useCurrentWidgetId } from "../../core/workspace/moduleRuntime";
import "./nav.css";

export function NavModule() {
  const navId = useCurrentWidgetId();
  const widgets = useLayoutStore((state) => state.widgets);
  const childWidgets = useMemo(() => {
    if (!navId) return [];
    const navWidget = widgets.find((widget) => widget.id === navId && widget.moduleId === "nav");
    if (!navWidget) return [];

    const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
    return (navWidget.children ?? [])
      .map((childId) => widgetsById.get(childId))
      .filter((child): child is (typeof widgets)[number] => Boolean(child));
  }, [navId, widgets]);

  const renderedChildren = useMemo(
    () =>
      childWidgets
        .map((child) => {
          const module = moduleRegistryById[child.moduleId];
          if (!module) return null;
          const ModuleComponent = module.component;
          return (
            <div key={child.id} className="nav-child-slot">
              <div className="nav-child-content">
                <WidgetRuntimeProvider widgetId={child.id}>
                  <ModuleComponent />
                </WidgetRuntimeProvider>
              </div>
            </div>
          );
        })
        .filter(Boolean),
    [childWidgets],
  );

  return (
    <section className="nav-module">
      <div className="nav-children">
        {renderedChildren}
      </div>
    </section>
  );
}
