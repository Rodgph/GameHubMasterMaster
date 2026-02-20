import { useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { moduleRegistry } from "../modules/registry";
import type { DockEdge, WidgetLayout } from "./layoutStore";
import { useLayoutStore } from "./layoutStore";
import { DockShell } from "./shells/DockShell";
import { WidgetShell } from "./shells/WidgetShell";
import "./Workspace.css";

const DOCK_SNAP_THRESHOLD = 24;
const PANEL_SNAP_THRESHOLD = 56;

type PanelOverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SnapState =
  | { widgetId: string; kind: "workspace-edge"; edge: DockEdge }
  | {
      widgetId: string;
      kind: "panel";
      targetWidgetId: string;
      side: DockEdge;
      rect: PanelOverlayRect;
    }
  | null;

export function Workspace() {
  const widgets = useLayoutStore((state) => state.widgets);
  const dockTree = useLayoutStore((state) => state.dockTree);
  const addWidget = useLayoutStore((state) => state.addWidget);
  const dockWidget = useLayoutStore((state) => state.dockWidget);
  const dockIntoLeaf = useLayoutStore((state) => state.dockIntoLeaf);
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

  const getDockPanelAtPoint = (pointerX: number, pointerY: number): HTMLElement | null => {
    const topEl = document.elementFromPoint(pointerX, pointerY) as HTMLElement | null;
    const immediatePanel = topEl?.closest("[data-dock-widget-id]") as HTMLElement | null;
    if (immediatePanel) return immediatePanel;

    const stack = document.elementsFromPoint(pointerX, pointerY);
    for (const element of stack) {
      if (!(element instanceof HTMLElement)) continue;
      const panel = element.closest("[data-dock-widget-id]") as HTMLElement | null;
      if (panel) return panel;
    }
    return null;
  };

  const getSideWithinPanel = (
    panelEl: HTMLElement,
    pointerX: number,
    pointerY: number,
  ): DockEdge | null => {
    const rect = panelEl.getBoundingClientRect();
    if (
      pointerX < rect.left ||
      pointerX > rect.right ||
      pointerY < rect.top ||
      pointerY > rect.bottom
    ) {
      return null;
    }
    if (pointerX <= rect.left + PANEL_SNAP_THRESHOLD) return "left";
    if (pointerX >= rect.right - PANEL_SNAP_THRESHOLD) return "right";
    if (pointerY <= rect.top + PANEL_SNAP_THRESHOLD) return "top";
    if (pointerY >= rect.bottom - PANEL_SNAP_THRESHOLD) return "bottom";
    return null;
  };

  const handleWidgetDragMove = (
    widgetId: string,
    _nextX: number,
    _nextY: number,
    pointerX: number,
    pointerY: number,
  ) => {
    const panelEl = getDockPanelAtPoint(pointerX, pointerY);
    if (panelEl) {
      const targetWidgetId = panelEl.dataset.dockWidgetId;
      const side = getSideWithinPanel(panelEl, pointerX, pointerY);
      if (targetWidgetId && side) {
        const rect = panelEl.getBoundingClientRect();
        setSnapState({
          widgetId,
          kind: "panel",
          targetWidgetId,
          side,
          rect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        });
        return;
      }
    }

    const edge = getEdgeFromPointer(pointerX, pointerY);
    setSnapState(edge ? { widgetId, kind: "workspace-edge", edge } : null);
  };

  const handleWidgetDragEnd = (
    widgetId: string,
    _pointerX: number,
    _pointerY: number,
    didDrag: boolean,
  ) => {
    if (!didDrag) {
      setSnapState(null);
      return;
    }

    if (snapState && snapState.widgetId === widgetId) {
      if (snapState.kind === "panel") {
        dockIntoLeaf(widgetId, snapState.targetWidgetId, snapState.side);
      } else {
        dockWidget(widgetId, snapState.edge);
      }
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
          {snapState?.kind === "workspace-edge" ? (
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
          {snapState?.kind === "panel" ? (
            <section
              className="panel-overlay"
              style={{
                left: snapState.rect.left,
                top: snapState.rect.top,
                width: snapState.rect.width,
                height: snapState.rect.height,
              }}
            >
              <div
                className={`panel-zone panel-zone-left ${snapState.side === "left" ? "active" : ""}`}
              />
              <div
                className={`panel-zone panel-zone-right ${snapState.side === "right" ? "active" : ""}`}
              />
              <div
                className={`panel-zone panel-zone-top ${snapState.side === "top" ? "active" : ""}`}
              />
              <div
                className={`panel-zone panel-zone-bottom ${snapState.side === "bottom" ? "active" : ""}`}
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
