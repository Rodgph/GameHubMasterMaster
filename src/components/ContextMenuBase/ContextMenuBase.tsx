import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ContextMenuBase.css";

type AnchorPoint = {
  x: number;
  y: number;
};

export type ContextMenuBaseItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  kind?: "item" | "divider";
  onClick?: () => void;
};

type PreferredPlacement = "right-bottom" | "left-bottom" | "right-top" | "left-top";

type ContextMenuBaseProps = {
  open: boolean;
  anchorPoint: AnchorPoint;
  onClose: () => void;
  items: ContextMenuBaseItem[];
  preferredPlacement?: PreferredPlacement;
  offset?: number;
  safeMargin?: number;
  className?: string;
  itemClassName?: string;
  secondaryItemClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
  dividerClassName?: string;
  backdropClassName?: string;
};

type Position = {
  left: number;
  top: number;
};

function getPlacementDirection(placement: PreferredPlacement) {
  return {
    horizontal: placement.startsWith("right") ? 1 : -1,
    vertical: placement.endsWith("bottom") ? 1 : -1,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ContextMenuBase({
  open,
  anchorPoint,
  onClose,
  items,
  preferredPlacement = "right-bottom",
  offset = 8,
  safeMargin = 8,
  className,
  itemClassName,
  secondaryItemClassName,
  iconClassName,
  labelClassName,
  dividerClassName,
  backdropClassName,
}: ContextMenuBaseProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position>({ left: anchorPoint.x, top: anchorPoint.y });

  const visibleItems = useMemo(() => items.filter((item) => item.kind !== "divider" || items.length > 1), [items]);

  const recalculatePosition = useMemo(
    () => () => {
      if (!menuRef.current) return;
      const menuRect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxLeft = Math.max(safeMargin, vw - menuRect.width - safeMargin);
      const maxTop = Math.max(safeMargin, vh - menuRect.height - safeMargin);
      const base = getPlacementDirection(preferredPlacement);

      let left = anchorPoint.x + base.horizontal * offset;
      let top = anchorPoint.y + base.vertical * offset;

      if (base.horizontal > 0 && left + menuRect.width > vw - safeMargin) {
        left = anchorPoint.x - menuRect.width - offset;
      }
      if (base.horizontal < 0 && left < safeMargin) {
        left = anchorPoint.x + offset;
      }

      if (base.vertical > 0 && top + menuRect.height > vh - safeMargin) {
        top = anchorPoint.y - menuRect.height - offset;
      }
      if (base.vertical < 0 && top < safeMargin) {
        top = anchorPoint.y + offset;
      }

      setPosition({
        left: clamp(left, safeMargin, maxLeft),
        top: clamp(top, safeMargin, maxTop),
      });
    },
    [anchorPoint.x, anchorPoint.y, offset, preferredPlacement, safeMargin],
  );

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    recalculatePosition();
  }, [open, recalculatePosition, visibleItems.length]);

  useEffect(() => {
    if (!open) return;
    const onViewportChange = () => recalculatePosition();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, recalculatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || visibleItems.length === 0) return null;

  return createPortal(
    <>
      <div
        className={`context-menu-base-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}`}
        data-no-drag="true"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className={`context-menu-base-surface${className ? ` ${className}` : ""}`}
        data-no-drag="true"
        style={{ left: position.left, top: position.top }}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleItems.map((item) =>
          item.kind === "divider" ? (
            <div
              key={item.id}
              className={`context-menu-base-divider${dividerClassName ? ` ${dividerClassName}` : ""}`}
            />
          ) : (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={`context-menu-base-item${itemClassName ? ` ${itemClassName}` : ""}${item.secondary ? ` context-menu-base-item-secondary${secondaryItemClassName ? ` ${secondaryItemClassName}` : ""}` : ""}`}
              onClick={() => {
                if (item.disabled) return;
                item.onClick?.();
                onClose();
              }}
            >
              {item.icon ? (
                <span
                  className={`context-menu-base-item-icon${iconClassName ? ` ${iconClassName}` : ""}`}
                >
                  {item.icon}
                </span>
              ) : null}
              <span
                className={`context-menu-base-item-label${labelClassName ? ` ${labelClassName}` : ""}`}
              >
                {item.label}
              </span>
            </button>
          ),
        )}
      </div>
    </>,
    document.body,
  );
}
