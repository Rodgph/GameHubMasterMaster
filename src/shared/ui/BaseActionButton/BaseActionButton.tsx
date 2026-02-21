import type { MouseEvent, ReactNode } from "react";
import "./BaseActionButton.css";

type BaseActionButtonProps = {
  label: string;
  icon?: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function BaseActionButton({ label, icon, onClick }: BaseActionButtonProps) {
  return (
    <button type="button" className="base-action-button" data-no-drag="true" onClick={onClick}>
      {icon ? <span className="base-action-button-icon">{icon}</span> : null}
      <span className="base-action-button-label">{label}</span>
    </button>
  );
}
