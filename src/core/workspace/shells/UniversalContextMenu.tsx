import { useEffect, useRef } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  secondary?: boolean;
  onSelect: () => void;
};

type UniversalContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function UniversalContextMenu({ open, x, y, items, onClose }: UniversalContextMenuProps) {
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

  if (!open || items.length === 0) return null;

  return (
    <section ref={menuRef} className="tab-context-menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`tab-context-item ${item.secondary ? "tab-context-secondary" : ""}`}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </section>
  );
}
