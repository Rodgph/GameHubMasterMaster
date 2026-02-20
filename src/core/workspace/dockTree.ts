export type DockNodeId = string;
export type DockPosition = "start" | "end";
export type InsertPosition = "start" | "end";

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

export function insertSplitAtLeaf(
  node: DockNode | null,
  targetWidgetId: string,
  direction: "row" | "column",
  newLeaf: DockLeaf,
  position: InsertPosition,
): DockNode | null {
  if (!node) return newLeaf;

  if (node.kind === "leaf") {
    if (node.widgetId !== targetWidgetId) return node;
    const children: [DockNode, DockNode] = position === "start" ? [newLeaf, node] : [node, newLeaf];
    return {
      id: crypto.randomUUID(),
      kind: "split",
      direction,
      ratio: 0.5,
      children,
    };
  }

  const nextLeft = insertSplitAtLeaf(
    node.children[0],
    targetWidgetId,
    direction,
    newLeaf,
    position,
  );
  if (nextLeft !== node.children[0]) {
    return {
      ...node,
      children: [nextLeft as DockNode, node.children[1]],
    };
  }

  const nextRight = insertSplitAtLeaf(
    node.children[1],
    targetWidgetId,
    direction,
    newLeaf,
    position,
  );
  if (nextRight !== node.children[1]) {
    return {
      ...node,
      children: [node.children[0], nextRight as DockNode],
    };
  }

  return node;
}

export function moveLeafToSplit(
  root: DockNode | null,
  movingWidgetId: string,
  targetWidgetId: string,
  side: "left" | "right" | "top" | "bottom",
): DockNode | null {
  if (movingWidgetId === targetWidgetId) return root;

  const removed = removeLeafByWidgetId(root, movingWidgetId);
  if (!removed) return createLeaf(movingWidgetId);

  const direction = side === "left" || side === "right" ? "row" : "column";
  const position = side === "left" || side === "top" ? "start" : "end";
  const next = insertSplitAtLeaf(
    removed,
    targetWidgetId,
    direction,
    createLeaf(movingWidgetId),
    position,
  );
  if (next === removed) return removed;
  return next;
}

export function updateSplitRatio(
  node: DockNode | null,
  splitId: string,
  nextRatio: number,
): DockNode | null {
  if (!node) return null;
  if (node.kind === "leaf") return node;
  if (node.id === splitId) {
    return {
      ...node,
      ratio: nextRatio,
    };
  }

  const nextLeft = updateSplitRatio(node.children[0], splitId, nextRatio);
  const nextRight = updateSplitRatio(node.children[1], splitId, nextRatio);
  if (nextLeft === node.children[0] && nextRight === node.children[1]) return node;

  return {
    ...node,
    children: [nextLeft as DockNode, nextRight as DockNode],
  };
}
