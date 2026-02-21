import type { ReactNode } from "react";
import "./StoryCreateActionButton.css";

type StoryCreateActionButtonProps = {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export function StoryCreateActionButton({
  label,
  icon,
  active = false,
  onClick,
}: StoryCreateActionButtonProps) {
  return (
    <button
      type="button"
      className={`story-create-action-button${active ? " story-create-action-button-active" : ""}`}
      data-no-drag="true"
      onClick={onClick}
    >
      <span className="story-create-action-icon">{icon}</span>
      <span className="story-create-action-label">{label}</span>
    </button>
  );
}
