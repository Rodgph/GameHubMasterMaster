import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";

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
  const mappedItems: ContextMenuBaseItem[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    secondary: item.secondary,
    onClick: item.onSelect,
  }));

  return (
    <ContextMenuBase
      open={open}
      anchorPoint={{ x, y }}
      onClose={onClose}
      items={mappedItems}
      preferredPlacement="right-bottom"
      className="tab-context-menu"
      itemClassName="tab-context-item"
      secondaryItemClassName="tab-context-secondary"
      backdropClassName="tab-context-backdrop"
    />
  );
}
