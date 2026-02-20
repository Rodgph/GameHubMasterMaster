import { useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import { moduleRegistryById } from "../../modules/registry";
import { useLayoutStore } from "../layoutStore";
import type { WidgetLayout } from "../layoutStore";
import { createThresholdDragSession } from "../interaction";

type WidgetShellProps = {
  widget: WidgetLayout;
};

export function WidgetShell({ widget }: WidgetShellProps) {
  const module = moduleRegistryById[widget.moduleId];
  const closeWidget = useLayoutStore((state) => state.closeWidget);
  const updateWidget = useLayoutStore((state) => state.updateWidget);
  const bringToFront = useLayoutStore((state) => state.bringToFront);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const resizeOriginRef = useRef<{ w: number; h: number } | null>(null);
  const ModuleComponent = useMemo(() => module.component, [module.component]);

  const startMove = (event: PointerEvent<HTMLElement>) => {
    createThresholdDragSession(event, {
      onStart: () => {
        bringToFront(widget.id);
        dragOriginRef.current = { x: widget.x, y: widget.y };
      },
      onMove: (dx, dy) => {
        const dragOrigin = dragOriginRef.current;
        if (!dragOrigin) return;
        updateWidget(widget.id, {
          x: Math.max(0, dragOrigin.x + dx),
          y: Math.max(0, dragOrigin.y + dy),
        });
      },
      onEnd: () => {
        dragOriginRef.current = null;
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
      className="widget-shell"
      style={{
        transform: `translate(${widget.x}px, ${widget.y}px)`,
        width: `${widget.w}px`,
        height: `${widget.h}px`,
        zIndex: widget.z,
      }}
      onPointerDown={() => bringToFront(widget.id)}
    >
      <header className="widget-header" onPointerDown={startMove}>
        <span>{module.title}</span>
        <button type="button" data-no-drag="true" onClick={() => closeWidget(widget.id)}>
          Fechar
        </button>
      </header>
      <div className="widget-content">
        <ModuleComponent />
      </div>
      <div className="widget-resize-handle" onPointerDown={startResize} />
    </article>
  );
}
