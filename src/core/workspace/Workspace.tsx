import { useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { moduleRegistry } from "../modules/registry";
import type { DockEdge, WidgetLayout } from "./layoutStore";
import { useLayoutStore } from "./layoutStore";
import { DockShell } from "./shells/DockShell";
import { WidgetShell } from "./shells/WidgetShell";
import "./Workspace.css";

const DOCK_SNAP_THRESHOLD = 24;

type SnapState = {
  widgetId: string;
  edge: DockEdge | null;
};

export function Workspace() {
  const widgets = useLayoutStore((state) => state.widgets);
  const dockTree = useLayoutStore((state) => state.dockTree);
  const addWidget = useLayoutStore((state) => state.addWidget);
  const dockWidget = useLayoutStore((state) => state.dockWidget);
  const resetLayout = useLayoutStore((state) => state.resetLayout);
  const canvasRef = useRef<HTMLElement | null>(null);
  const [snapState, setSnapState] = useState<SnapState | null>(null);

  const floatingWidgets = useMemo(
    () => widgets.filter((widget) => widget.mode === "widget"),
    [widgets],
  );
  const widgetsById = useMemo<Record<string, WidgetLayout>>(
    () => Object.fromEntries(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );

  const getEdgeFromPointer = (pointerX: number, pointerY: number): DockEdge | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (
      pointerX < rect.left ||
      pointerX > rect.right ||
      pointerY < rect.top ||
      pointerY > rect.bottom
    ) {
      return null;
    }
    if (pointerX - rect.left <= DOCK_SNAP_THRESHOLD) return "left";
    if (rect.right - pointerX <= DOCK_SNAP_THRESHOLD) return "right";
    if (pointerY - rect.top <= DOCK_SNAP_THRESHOLD) return "top";
    if (rect.bottom - pointerY <= DOCK_SNAP_THRESHOLD) return "bottom";
    return null;
  };

  const handleWidgetDragMove = (
    widgetId: string,
    _nextX: number,
    _nextY: number,
    pointerX: number,
    pointerY: number,
  ) => {
    const edge = getEdgeFromPointer(pointerX, pointerY);
    setSnapState({ widgetId, edge });
  };

  const handleWidgetDragEnd = (
    widgetId: string,
    pointerX: number,
    pointerY: number,
    didDrag: boolean,
  ) => {
    if (!didDrag) {
      setSnapState(null);
      return;
    }
    const edge = getEdgeFromPointer(pointerX, pointerY);
    if (edge) {
      dockWidget(widgetId, edge);
    }
    setSnapState(null);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <main className="workspace-canvas" ref={canvasRef}>
          {dockTree.root ? (
            <section className="dock-root">
              <DockShell node={dockTree.root} widgetsById={widgetsById} />
            </section>
          ) : null}
          {floatingWidgets.map((widget) => (
            <WidgetShell
              key={widget.id}
              widget={widget}
              onDragMove={handleWidgetDragMove}
              onDragEnd={handleWidgetDragEnd}
            />
          ))}
          {snapState ? (
            <section className="dock-overlay">
              <div
                className={`dock-zone dock-zone-left ${snapState.edge === "left" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-right ${snapState.edge === "right" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-top ${snapState.edge === "top" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-bottom ${snapState.edge === "bottom" ? "active" : ""}`}
              />
            </section>
          ) : null}
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
