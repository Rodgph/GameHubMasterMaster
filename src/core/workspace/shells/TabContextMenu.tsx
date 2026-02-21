import { useEffect, useRef } from "react";

type TabContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onPopout: () => void;
  onCloseTab: () => void;
};

export function TabContextMenu({ open, x, y, onClose, onPopout, onCloseTab }: TabContextMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("contextmenu", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("contextmenu", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <section ref={menuRef} className="tab-context-menu" style={{ left: x, top: y }}>
      <button
        type="button"
        className="tab-context-item"
        onClick={() => {
          onPopout();
          onClose();
        }}
      >
        <span>Abrir em janela (Popout)</span>
      </button>
      <button
        type="button"
        className="tab-context-item tab-context-danger"
        onClick={() => {
          onCloseTab();
          onClose();
        }}
      >
        <span>Fechar</span>
      </button>
    </section>
  );
}
