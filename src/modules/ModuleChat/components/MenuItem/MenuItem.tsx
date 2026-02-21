import type { ReactNode } from "react";
import "./MenuItem.css";

type MenuItemProps = {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
  dividerTop?: boolean;
};

export function MenuItem({ icon, label, onClick, muted, dividerTop }: MenuItemProps) {
  return (
    <>
      {dividerTop ? <div className="settings-menu-divider" /> : null}
      <button type="button" className="settings-menu-item" data-no-drag="true" onClick={onClick}>
        {icon ? <span className="settings-menu-item-icon">{icon}</span> : null}
        <span className={`settings-menu-item-label${muted ? " is-muted" : ""}`}>{label}</span>
      </button>
    </>
  );
}
