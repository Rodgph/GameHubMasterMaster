import type { ButtonHTMLAttributes } from "react";
import "./BackButton.css";

type BackButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel?: string;
};

export function BackButton({
  ariaLabel = "Voltar",
  className,
  type = "button",
  ...props
}: BackButtonProps) {
  return (
    <button
      type={type}
      className={`back-button${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
      {...props}
    />
  );
}
