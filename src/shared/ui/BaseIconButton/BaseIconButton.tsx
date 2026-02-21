import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./BaseIconButton.css";

type BaseIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  ariaLabel?: string;
};

export function BaseIconButton({
  children,
  className = "",
  ariaLabel,
  ...props
}: BaseIconButtonProps) {
  const mergedClassName = ["base-icon-button", className].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      data-no-drag="true"
      className={mergedClassName}
      aria-label={ariaLabel ?? props["aria-label"]}
      {...props}
    >
      {children}
    </button>
  );
}
