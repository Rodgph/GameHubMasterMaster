import * as ContextMenu from "@radix-ui/react-context-menu";
import { moduleRegistry } from "../modules/registry";
import { useLayoutStore } from "./layoutStore";
import { WidgetShell } from "./shells/WidgetShell";
import "./Workspace.css";

export function Workspace() {
  const widgets = useLayoutStore((state) => state.widgets);
  const addWidget = useLayoutStore((state) => state.addWidget);
  const resetLayout = useLayoutStore((state) => state.resetLayout);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <main className="workspace-canvas">
          {widgets.map((widget) => (
            <WidgetShell key={widget.id} widget={widget} />
          ))}
        </main>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="workspace-menu">
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="workspace-menu-item">
              Adicionar modulo
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="workspace-menu">
                {moduleRegistry.map((module) => (
                  <ContextMenu.Item
                    key={module.id}
                    className="workspace-menu-item"
                    onSelect={() => addWidget(module.id)}
                  >
                    {module.title}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <ContextMenu.Separator className="workspace-menu-separator" />
          <ContextMenu.Item className="workspace-menu-item" onSelect={resetLayout}>
            Reset layout
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
