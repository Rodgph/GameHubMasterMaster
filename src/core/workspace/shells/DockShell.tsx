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
  const closeDockTab = useLayoutStore((state) => state.closeDockTab);
  const setActiveDockTab = useLayoutStore((state) => state.setActiveDockTab);
  const setDockSplitRatio = useLayoutStore((state) => state.setDockSplitRatio);

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

  const startResizeSplit = (
    event: ReactPointerEvent<HTMLElement>,
    splitId: string,
    direction: "row" | "column",
  ) => {
    if (event.button !== 0) return;

    const divider = event.currentTarget;
    const splitEl = divider.closest(".dock-split");
    if (!(splitEl instanceof HTMLElement)) return;

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
        divider.setPointerCapture(pointerId);
        moveEvent.preventDefault();
      }

      const rect = splitEl.getBoundingClientRect();
      if (direction === "row" && rect.width > 0) {
        const ratio = (moveEvent.clientX - rect.left) / rect.width;
        setDockSplitRatio(splitId, Math.max(0.15, Math.min(0.85, ratio)));
      }
      if (direction === "column" && rect.height > 0) {
        const ratio = (moveEvent.clientY - rect.top) / rect.height;
        setDockSplitRatio(splitId, Math.max(0.15, Math.min(0.85, ratio)));
      }
    };

    const onPointerUp = () => {
      if (dragging && divider.hasPointerCapture(pointerId)) {
        divider.releasePointerCapture(pointerId);
      }
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  if (node.kind === "leaf") {
    const activeWidget = widgetsById[node.activeWidgetId];
    if (!activeWidget) return null;

    const module = moduleRegistryById[activeWidget.moduleId];
    const ModuleComponent = module.component;

    return (
      <section className="dock-panel" data-dock-widget-id={activeWidget.id}>
        <header
          className="dock-header"
          onPointerDown={(event) => startDockHeaderDrag(event, activeWidget.id)}
        >
          <div className="dock-tabs" data-no-drag="true">
            {node.widgetIds
              .map((widgetId) => widgetsById[widgetId])
              .filter((widget): widget is WidgetLayout => Boolean(widget))
              .map((widget) => {
                const tabModule = moduleRegistryById[widget.moduleId];
                const isActive = widget.id === node.activeWidgetId;
                return (
                  <button
                    key={widget.id}
                    type="button"
                    className={`dock-tab ${isActive ? "active" : ""}`}
                    data-no-drag="true"
                    onClick={() => setActiveDockTab(node.id, widget.id)}
                  >
                    <span>{tabModule.title}</span>
                    <span
                      className="dock-tab-close"
                      data-no-drag="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeDockTab(node.id, widget.id);
                      }}
                    >
                      x
                    </span>
                  </button>
                );
              })}
          </div>
        </header>
        <div className="dock-content">
          <ModuleComponent />
        </div>
      </section>
    );
  }

  return (
    <section className={`dock-split dock-${node.direction}`}>
      <div className="dock-split-child" style={{ flexGrow: node.ratio }}>
        <DockShell
          node={node.children[0]}
          widgetsById={widgetsById}
          onDockDragMove={onDockDragMove}
          onDockDragEnd={onDockDragEnd}
        />
      </div>
      <div
        className={`dock-divider dock-divider-${node.direction}`}
        data-no-drag="true"
        onPointerDown={(event) => startResizeSplit(event, node.id, node.direction)}
      />
      <div className="dock-split-child" style={{ flexGrow: 1 - node.ratio }}>
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
