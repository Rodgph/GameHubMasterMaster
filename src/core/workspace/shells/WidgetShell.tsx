import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { moduleRegistryById } from "../../modules/registry";
import { useLayoutStore } from "../layoutStore";
import type { WidgetLayout } from "../layoutStore";
import { createThresholdDragSession } from "../interaction";
import { WidgetRuntimeProvider } from "../moduleRuntime";
import { UniversalContextMenu, type ContextMenuItem } from "./UniversalContextMenu";

type WidgetShellProps = {
  widget: WidgetLayout;
  onDragMove?: (
    widgetId: string,
    nextX: number,
    nextY: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onDragEnd?: (widgetId: string, pointerX: number, pointerY: number, didDrag: boolean) => void;
};

export function WidgetShell({ widget, onDragMove, onDragEnd }: WidgetShellProps) {
  const module = moduleRegistryById[widget.moduleId];
  if (!module) return null;
  const closeWidget = useLayoutStore((state) => state.closeWidget);
  const updateWidget = useLayoutStore((state) => state.updateWidget);
  const bringToFront = useLayoutStore((state) => state.bringToFront);
  const duplicateWidget = useLayoutStore((state) => state.duplicateWidget);
  const togglePinWidget = useLayoutStore((state) => state.togglePinWidget);
  const spawnWidgetWindow = useLayoutStore((state) => state.spawnWidgetWindow);
  const reattachWidgetToDock = useLayoutStore((state) => state.reattachWidgetToDock);
  const undockWidget = useLayoutStore((state) => state.undockWidget);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const resizeOriginRef = useRef<{ w: number; h: number } | null>(null);
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });
  const ModuleComponent = useMemo(() => module.component, [module.component]);
  const menuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        id: "open-window",
        label: "Abrir em janela",
        onSelect: () => {
          void spawnWidgetWindow(widget.id);
        },
      },
      {
        id: "reattach",
        label: "Reanexar ao dock",
        onSelect: () => {
          void reattachWidgetToDock(widget.id);
        },
      },
      {
        id: "dom-widget",
        label: "Transformar em widget interno",
        onSelect: () => {
          undockWidget(widget.id);
        },
      },
      {
        id: "duplicate",
        label: "Duplicar",
        onSelect: () => duplicateWidget(widget.id),
      },
      {
        id: "pin",
        label: widget.pinned ? "Desfixar" : "Fixar",
        onSelect: () => togglePinWidget(widget.id),
      },
      {
        id: "close",
        label: "Fechar",
        secondary: true,
        onSelect: () => closeWidget(widget.id),
      },
    ],
    [
      closeWidget,
      duplicateWidget,
      reattachWidgetToDock,
      spawnWidgetWindow,
      togglePinWidget,
      undockWidget,
      widget.id,
      widget.pinned,
    ],
  );

  const startMove = (event: PointerEvent<HTMLElement>) => {
    createThresholdDragSession(event, {
      onStart: () => {
        bringToFront(widget.id);
        dragOriginRef.current = { x: widget.x, y: widget.y };
      },
      onMove: (dx, dy, pointerX, pointerY) => {
        const dragOrigin = dragOriginRef.current;
        if (!dragOrigin) return;
        const nextX = Math.max(0, dragOrigin.x + dx);
        const nextY = Math.max(0, dragOrigin.y + dy);
        updateWidget(widget.id, {
          x: nextX,
          y: nextY,
        });
        onDragMove?.(widget.id, nextX, nextY, pointerX, pointerY);
      },
      onEnd: (pointerX, pointerY, didDrag) => {
        dragOriginRef.current = null;
        onDragEnd?.(widget.id, pointerX, pointerY, didDrag);
      },
    });
  };

  const startResize = (event: PointerEvent<HTMLElement>) => {
    createThresholdDragSession(event, {
      onStart: () => {
        bringToFront(widget.id);
        resizeOriginRef.current = { w: widget.w, h: widget.h };
      },
      onMove: (dx, dy) => {
        const resizeOrigin = resizeOriginRef.current;
        if (!resizeOrigin) return;
        updateWidget(widget.id, {
          w: resizeOrigin.w + dx,
          h: resizeOrigin.h + dy,
        });
      },
      onEnd: () => {
        resizeOriginRef.current = null;
      },
    });
  };

  return (
    <article
      className={`widget-shell ${widget.pinned ? "pinned" : ""}`}
      style={{
        transform: `translate(${widget.x}px, ${widget.y}px)`,
        width: `${widget.w}px`,
        height: `${widget.h}px`,
        zIndex: widget.z,
      }}
      onPointerDown={(event) => {
        bringToFront(widget.id);
        startMove(event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuState({
          open: true,
          x: event.clientX,
          y: event.clientY,
        });
      }}
    >
      <header className="widget-header">
        <span>{module.title}</span>
        <button type="button" data-no-drag="true" onClick={() => closeWidget(widget.id)}>
          Fechar
        </button>
      </header>
      <div className="widget-content">
        <WidgetRuntimeProvider widgetId={widget.id}>
          <ModuleComponent />
        </WidgetRuntimeProvider>
      </div>
      <div className="widget-resize-handle" data-no-drag="true" onPointerDown={startResize} />
      <UniversalContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuItems}
        onClose={() =>
          setMenuState({
            open: false,
            x: 0,
            y: 0,
          })
        }
      />
    </article>
  );
}
