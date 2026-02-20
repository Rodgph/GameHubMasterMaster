export type DockNodeId = string;

export type DockLeaf = {
  id: DockNodeId;
  kind: "leaf";
  widgetIds: string[];
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
