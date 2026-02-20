export type DockNodeId = string;
export type DockPosition = "start" | "end";

export type DockLeaf = {
  id: DockNodeId;
  kind: "leaf";
  widgetId: string;
};

export type DockSplit = {
  id: DockNodeId;
  kind: "split";
  direction: "row" | "column";
  children: [DockNode, DockNode];
  ratio: number;
};

export type DockNode = DockLeaf | DockSplit;

export type DockTree = {
  root: DockNode | null;
};

export function createEmptyDockTree(): DockTree {
  return { root: null };
}

export function createLeaf(widgetId: string): DockLeaf {
  return {
    id: crypto.randomUUID(),
    kind: "leaf",
    widgetId,
  };
}

export function splitRoot(
  tree: DockTree,
  direction: "row" | "column",
  newLeaf: DockLeaf,
  position: DockPosition,
): DockTree {
  if (!tree.root) {
    return { root: newLeaf };
  }

  const children: [DockNode, DockNode] =
    position === "start" ? [newLeaf, tree.root] : [tree.root, newLeaf];

  return {
    root: {
      id: crypto.randomUUID(),
      kind: "split",
      direction,
      ratio: 0.5,
      children,
    },
  };
}

export function removeLeafByWidgetId(node: DockNode | null, widgetId: string): DockNode | null {
  if (!node) return null;

  if (node.kind === "leaf") {
    return node.widgetId === widgetId ? null : node;
  }

  const left = removeLeafByWidgetId(node.children[0], widgetId);
  const right = removeLeafByWidgetId(node.children[1], widgetId);

  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;

  return {
    ...node,
    children: [left, right],
  };
}
