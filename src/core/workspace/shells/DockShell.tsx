import { moduleRegistryById } from "../../modules/registry";
import type { DockNode } from "../dockTree";
import { useLayoutStore } from "../layoutStore";
import type { WidgetLayout } from "../layoutStore";

type DockShellProps = {
  node: DockNode;
  widgetsById: Record<string, WidgetLayout>;
};

export function DockShell({ node, widgetsById }: DockShellProps) {
  const closeWidget = useLayoutStore((state) => state.closeWidget);

  if (node.kind === "leaf") {
    const widget = widgetsById[node.widgetId];
    if (!widget) return null;

    const module = moduleRegistryById[widget.moduleId];
    const ModuleComponent = module.component;

    return (
      <section className="dock-panel" data-dock-widget-id={widget.id}>
        <header className="dock-header">
          <span>{module.title}</span>
          <button type="button" data-no-drag="true" onClick={() => closeWidget(widget.id)}>
            Fechar
          </button>
        </header>
        <div className="dock-content">
          <ModuleComponent />
        </div>
      </section>
    );
  }

  return (
    <section className={`dock-split dock-${node.direction}`}>
      <div style={{ flexGrow: node.ratio }}>
        <DockShell node={node.children[0]} widgetsById={widgetsById} />
      </div>
      <div style={{ flexGrow: 1 - node.ratio }}>
        <DockShell node={node.children[1]} widgetsById={widgetsById} />
      </div>
    </section>
  );
}
