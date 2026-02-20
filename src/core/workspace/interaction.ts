import type { PointerEvent as ReactPointerEvent } from "react";

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

function isBlockedDragTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;
  if (target.closest(INTERACTIVE_SELECTOR)) return true;
  if (target.closest("[data-scroll-region]")) return true;
  return false;
}

type DragSessionOptions = {
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd?: () => void;
};

export function createThresholdDragSession(
  event: ReactPointerEvent<HTMLElement>,
  options: DragSessionOptions,
) {
  if (event.button !== 0) return;
  if (isBlockedDragTarget(event.target)) return;

  const element = event.currentTarget;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const onPointerMove = (moveEvent: PointerEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      element.setPointerCapture(pointerId);
      moveEvent.preventDefault();
      options.onStart();
    }
    options.onMove(dx, dy);
  };

  const onPointerUp = () => {
    if (dragging && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    cleanup();
    options.onEnd?.();
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}
