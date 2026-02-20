export type DockNodeId = string;
export type DockPosition = "start" | "end";
export type InsertPosition = "start" | "end";

export type DockLeaf = {
  id: DockNodeId;
  kind: "leaf";
  widgetIds: string[];
  activeWidgetId: string;
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
    widgetIds: [widgetId],
    activeWidgetId: widgetId,
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
    if (!node.widgetIds.includes(widgetId)) return node;
    const nextWidgetIds = node.widgetIds.filter((id) => id !== widgetId);
    if (nextWidgetIds.length === 0) return null;
    return {
      ...node,
      widgetIds: nextWidgetIds,
      activeWidgetId: node.activeWidgetId === widgetId ? nextWidgetIds[0] : node.activeWidgetId,
    };
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
    if (!node.widgetIds.includes(targetWidgetId)) return node;
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

export function insertAsTabAtLeaf(
  root: DockNode | null,
  targetWidgetId: string,
  movingId: string,
): DockNode | null {
  if (!root) return null;

  if (root.kind === "leaf") {
    if (!root.widgetIds.includes(targetWidgetId)) return root;
    const deduped = root.widgetIds.filter((id) => id !== movingId);
    return {
      ...root,
      widgetIds: [...deduped, movingId],
      activeWidgetId: movingId,
    };
  }

  const nextLeft = insertAsTabAtLeaf(root.children[0], targetWidgetId, movingId);
  if (nextLeft !== root.children[0]) {
    return {
      ...root,
      children: [nextLeft as DockNode, root.children[1]],
    };
  }

  const nextRight = insertAsTabAtLeaf(root.children[1], targetWidgetId, movingId);
  if (nextRight !== root.children[1]) {
    return {
      ...root,
      children: [root.children[0], nextRight as DockNode],
    };
  }

  return root;
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

export function updateLeafActive(
  node: DockNode | null,
  leafId: string,
  widgetId: string,
): DockNode | null {
  if (!node) return null;
  if (node.kind === "leaf") {
    if (node.id !== leafId) return node;
    if (!node.widgetIds.includes(widgetId)) return node;
    return {
      ...node,
      activeWidgetId: widgetId,
    };
  }

  const nextLeft = updateLeafActive(node.children[0], leafId, widgetId);
  const nextRight = updateLeafActive(node.children[1], leafId, widgetId);
  if (nextLeft === node.children[0] && nextRight === node.children[1]) return node;

  return {
    ...node,
    children: [nextLeft as DockNode, nextRight as DockNode],
  };
}

export function moveTabWithinLeaf(
  root: DockNode | null,
  leafId: string,
  widgetId: string,
  toIndex: number,
): DockNode | null {
  if (!root) return null;
  if (root.kind === "leaf") {
    if (root.id !== leafId) return root;
    const currentIndex = root.widgetIds.indexOf(widgetId);
    if (currentIndex === -1) return root;
    const nextIds = [...root.widgetIds];
    nextIds.splice(currentIndex, 1);
    const clamped = Math.max(0, Math.min(nextIds.length, toIndex));
    nextIds.splice(clamped, 0, widgetId);
    return {
      ...root,
      widgetIds: nextIds,
      activeWidgetId: root.activeWidgetId,
    };
  }

  const nextLeft = moveTabWithinLeaf(root.children[0], leafId, widgetId, toIndex);
  const nextRight = moveTabWithinLeaf(root.children[1], leafId, widgetId, toIndex);
  if (nextLeft === root.children[0] && nextRight === root.children[1]) return root;

  return {
    ...root,
    children: [nextLeft as DockNode, nextRight as DockNode],
  };
}

export function removeTabFromLeaf(
  root: DockNode | null,
  leafId: string,
  widgetId: string,
): DockNode | null {
  if (!root) return null;
  if (root.kind === "leaf") {
    if (root.id !== leafId) return root;
    if (!root.widgetIds.includes(widgetId)) return root;
    const nextIds = root.widgetIds.filter((id) => id !== widgetId);
    if (nextIds.length === 0) return null;
    return {
      ...root,
      widgetIds: nextIds,
      activeWidgetId: root.activeWidgetId === widgetId ? nextIds[0] : root.activeWidgetId,
    };
  }

  const left = removeTabFromLeaf(root.children[0], leafId, widgetId);
  const right = removeTabFromLeaf(root.children[1], leafId, widgetId);
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  if (left === root.children[0] && right === root.children[1]) return root;

  return {
    ...root,
    children: [left, right],
  };
}

export function insertTabIntoLeafById(
  root: DockNode | null,
  leafId: string,
  widgetId: string,
  index?: number,
): DockNode | null {
  if (!root) return null;
  if (root.kind === "leaf") {
    if (root.id !== leafId) return root;
    const nextIds = root.widgetIds.filter((id) => id !== widgetId);
    const insertIndex = Math.max(0, Math.min(nextIds.length, index ?? nextIds.length));
    nextIds.splice(insertIndex, 0, widgetId);
    return {
      ...root,
      widgetIds: nextIds,
      activeWidgetId: widgetId,
    };
  }

  const nextLeft = insertTabIntoLeafById(root.children[0], leafId, widgetId, index);
  if (nextLeft !== root.children[0]) {
    return {
      ...root,
      children: [nextLeft as DockNode, root.children[1]],
    };
  }

  const nextRight = insertTabIntoLeafById(root.children[1], leafId, widgetId, index);
  if (nextRight !== root.children[1]) {
    return {
      ...root,
      children: [root.children[0], nextRight as DockNode],
    };
  }

  return root;
}
