import { useEffect, useRef, useState } from "react";
import { FiPlus } from "../../../../shared/ui/icons";
import "./FloatingCreateMenu.css";

type FloatingCreateMenuProps = {
  onCreateStory: () => void;
  onCreateGroup: () => void;
  onCreateServer: () => void;
};

export function FloatingCreateMenu({
  onCreateStory,
  onCreateGroup,
  onCreateServer,
}: FloatingCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="floating-create-menu" data-no-drag="true">
      {open ? (
        <div className="floating-create-menu-dropdown" data-no-drag="true">
          <button type="button" onClick={onCreateStory}>
            Criar story
          </button>
          <button type="button" onClick={onCreateGroup}>
            Criar grupo
          </button>
          <button type="button" onClick={onCreateServer}>
            Criar servidor
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="floating-create-menu-trigger"
        aria-label="Criar"
        onClick={() => setOpen((value) => !value)}
      >
        <FiPlus size={18} />
      </button>
    </div>
  );
}
