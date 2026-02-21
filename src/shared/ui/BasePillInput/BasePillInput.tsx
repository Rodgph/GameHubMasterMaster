import type { InputHTMLAttributes } from "react";
import "./BasePillInput.css";

type BasePillInputProps = InputHTMLAttributes<HTMLInputElement>;

export function BasePillInput({ className = "", ...props }: BasePillInputProps) {
  const mergedClassName = ["base-pill-input", className].filter(Boolean).join(" ");
  return <input type="text" data-no-drag="true" className={mergedClassName} {...props} />;
}
