import type { ReactNode } from "react";
import "./ContextMenuItem.css";

type ContextMenuItemProps = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
};

export function ContextMenuItem({ label, icon, onClick }: ContextMenuItemProps) {
  return (
    <button type="button" className="context-menu-item" data-no-drag="true" onClick={onClick}>
      {icon ? <span className="context-menu-item-icon">{icon}</span> : null}
      <span className="context-menu-item-label">{label}</span>
    </button>
  );
}
