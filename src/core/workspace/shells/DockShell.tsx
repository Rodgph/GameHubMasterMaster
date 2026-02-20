import type { PointerEvent as ReactPointerEvent } from "react";
import { moduleRegistryById } from "../../modules/registry";
import type { DockNode } from "../dockTree";
import { useLayoutStore } from "../layoutStore";
import type { WidgetLayout } from "../layoutStore";

const DRAG_THRESHOLD = 8;
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-no-drag="true"]',
].join(",");

type DockShellProps = {
  node: DockNode;
  widgetsById: Record<string, WidgetLayout>;
  onDockDragMove: (movingId: string, x: number, y: number) => void;
  onDockDragEnd: (movingId: string, x: number, y: number, didDrag: boolean) => void;
};

export function DockShell({ node, widgetsById, onDockDragMove, onDockDragEnd }: DockShellProps) {
  const closeWidget = useLayoutStore((state) => state.closeWidget);

  const startDockHeaderDrag = (event: ReactPointerEvent<HTMLElement>, widgetId: string) => {
    if (event.button !== 0) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return;
    event.preventDefault();

    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        element.style.cursor = "grabbing";
        element.setPointerCapture(pointerId);
        moveEvent.preventDefault();
      }
      onDockDragMove(widgetId, moveEvent.clientX, moveEvent.clientY);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (dragging && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      element.style.cursor = "";
      cleanup();
      onDockDragEnd(widgetId, upEvent.clientX, upEvent.clientY, dragging);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  if (node.kind === "leaf") {
    const widget = widgetsById[node.widgetId];
    if (!widget) return null;

    const module = moduleRegistryById[widget.moduleId];
    const ModuleComponent = module.component;

    return (
      <section className="dock-panel" data-dock-widget-id={widget.id}>
        <header
          className="dock-header"
          onPointerDown={(event) => startDockHeaderDrag(event, widget.id)}
        >
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
        <DockShell
          node={node.children[0]}
          widgetsById={widgetsById}
          onDockDragMove={onDockDragMove}
          onDockDragEnd={onDockDragEnd}
        />
      </div>
      <div style={{ flexGrow: 1 - node.ratio }}>
        <DockShell
          node={node.children[1]}
          widgetsById={widgetsById}
          onDockDragMove={onDockDragMove}
          onDockDragEnd={onDockDragEnd}
        />
      </div>
    </section>
  );
}
