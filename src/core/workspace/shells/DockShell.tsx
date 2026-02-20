import type { PointerEvent as ReactPointerEvent } from "react";
import { moduleRegistryById } from "../../modules/registry";
import type { DockNode } from "../dockTree";
import { useLayoutStore } from "../layoutStore";
import type { WidgetLayout } from "../layoutStore";

const DRAG_THRESHOLD = 8;
const UNDOCK_MARGIN = 40;
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
};

export function DockShell({ node, widgetsById }: DockShellProps) {
  const closeWidget = useLayoutStore((state) => state.closeWidget);
  const undockWidgetAt = useLayoutStore((state) => state.undockWidgetAt);

  const startUndockDrag = (event: ReactPointerEvent<HTMLElement>, widgetId: string) => {
    if (event.button !== 0) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return;
    event.preventDefault();

    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    let completed = false;

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

      const dockRoot = document.querySelector(".dock-root");
      if (!(dockRoot instanceof HTMLElement)) return;
      const rect = dockRoot.getBoundingClientRect();
      const outside =
        moveEvent.clientX < rect.left - UNDOCK_MARGIN ||
        moveEvent.clientX > rect.right + UNDOCK_MARGIN ||
        moveEvent.clientY < rect.top - UNDOCK_MARGIN ||
        moveEvent.clientY > rect.bottom + UNDOCK_MARGIN;
      if (!outside) return;

      completed = true;
      undockWidgetAt(widgetId, moveEvent.clientX - 200, moveEvent.clientY - 22);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      element.style.cursor = "";
      cleanup();
    };

    const onPointerUp = () => {
      if (!completed && dragging && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      element.style.cursor = "";
      cleanup();
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
          onPointerDown={(event) => startUndockDrag(event, widget.id)}
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
        <DockShell node={node.children[0]} widgetsById={widgetsById} />
      </div>
      <div style={{ flexGrow: 1 - node.ratio }}>
        <DockShell node={node.children[1]} widgetsById={widgetsById} />
      </div>
    </section>
  );
}
