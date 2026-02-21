import { useEffect, type ReactNode } from "react";
import "./ContextMenuOverlay.css";

type ContextMenuOverlayProps = {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
};

export function ContextMenuOverlay({ isOpen, x, y, onClose, children }: ContextMenuOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const onScroll = () => onClose();
    const onResize = () => onClose();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="context-menu-overlay" data-no-drag="true" onClick={onClose}>
      <div
        className="context-menu-surface"
        data-no-drag="true"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
