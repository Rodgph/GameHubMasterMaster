import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId, ModuleMode } from "../modules/types";
import {
  createEmptyDockTree,
  createLeaf,
  insertSplitAtLeaf,
  moveLeafToSplit,
  removeLeafByWidgetId,
  splitRoot,
  updateSplitRatio,
} from "./dockTree";
import type { DockTree } from "./dockTree";
import { moduleRegistryById } from "../modules/registry";

export type DockEdge = "left" | "right" | "top" | "bottom";

export type WidgetLayout = {
  id: string;
  moduleId: ModuleId;
  mode: ModuleMode;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type LayoutState = {
  widgets: WidgetLayout[];
  dockTree: DockTree;
  addWidget: (moduleId: ModuleId) => void;
  closeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<WidgetLayout>) => void;
  bringToFront: (id: string) => void;
  dockWidget: (id: string, edge: DockEdge) => void;
  dockIntoLeaf: (id: string, targetLeafWidgetId: string, side: DockEdge) => void;
  moveDockedWidget: (movingId: string, targetId: string, side: DockEdge) => void;
  setDockSplitRatio: (splitId: string, ratio: number) => void;
  undockWidget: (id: string) => void;
  undockWidgetAt: (id: string, x: number, y: number) => void;
  resetLayout: () => void;
};

function getNextZ(widgets: WidgetLayout[]) {
  return widgets.reduce((max, widget) => Math.max(max, widget.z), 0) + 1;
}

function clampWidget(widget: WidgetLayout): WidgetLayout {
  const constraints = moduleRegistryById[widget.moduleId].widgetConstraints;
  return {
    ...widget,
    w: Math.max(widget.w, constraints.minWidth),
    h: Math.max(widget.h, constraints.minHeight ?? 600),
  };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      widgets: [],
      dockTree: createEmptyDockTree(),
      addWidget: (moduleId) =>
        set((state) => {
          const constraints = moduleRegistryById[moduleId].widgetConstraints;
          const baseX = 80 + state.widgets.length * 24;
          const baseY = 80 + state.widgets.length * 24;
          const widget: WidgetLayout = {
            id: crypto.randomUUID(),
            moduleId,
            mode: "widget",
            x: baseX,
            y: baseY,
            w: Math.max(520, constraints.minWidth),
            h: Math.max(620, constraints.minHeight ?? 600),
            z: getNextZ(state.widgets),
          };
          return { widgets: [...state.widgets, widget] };
        }),
      updateWidget: (id, patch) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id ? clampWidget({ ...widget, ...patch }) : widget,
          ),
        })),
      bringToFront: (id) =>
        set((state) => {
          const nextZ = getNextZ(state.widgets);
          return {
            widgets: state.widgets.map((widget) =>
              widget.id === id ? { ...widget, z: nextZ } : widget,
            ),
          };
        }),
      dockWidget: (id, edge) =>
        set((state) => {
          const target = state.widgets.find((widget) => widget.id === id);
          if (!target) return state;
          if (target.mode === "dock") return state;

          const leaf = createLeaf(id);
          const direction = edge === "left" || edge === "right" ? "row" : "column";
          const position = edge === "left" || edge === "top" ? "start" : "end";

          return {
            widgets: state.widgets.map((widget) =>
              widget.id === id ? { ...widget, mode: "dock" } : widget,
            ),
            dockTree: splitRoot(state.dockTree, direction, leaf, position),
          };
        }),
      dockIntoLeaf: (id, targetLeafWidgetId, side) =>
        set((state) => {
          const target = state.widgets.find((widget) => widget.id === id);
          if (!target) return state;
          if (target.mode === "dock") return state;

          const leaf = createLeaf(id);
          const direction = side === "left" || side === "right" ? "row" : "column";
          const position = side === "left" || side === "top" ? "start" : "end";

          return {
            widgets: state.widgets.map((widget) =>
              widget.id === id ? { ...widget, mode: "dock" } : widget,
            ),
            dockTree: {
              root: insertSplitAtLeaf(
                state.dockTree.root,
                targetLeafWidgetId,
                direction,
                leaf,
                position,
              ),
            },
          };
        }),
      moveDockedWidget: (movingId, targetId, side) =>
        set((state) => ({
          dockTree: {
            root: moveLeafToSplit(state.dockTree.root, movingId, targetId, side),
          },
        })),
      setDockSplitRatio: (splitId, ratio) =>
        set((state) => ({
          dockTree: {
            root: updateSplitRatio(state.dockTree.root, splitId, ratio),
          },
        })),
      undockWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? {
                  ...widget,
                  mode: "widget",
                  x: 80,
                  y: 80,
                  z: getNextZ(state.widgets),
                }
              : widget,
          ),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, id),
          },
        })),
      undockWidgetAt: (id, x, y) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? {
                  ...widget,
                  mode: "widget",
                  x: Math.max(0, x),
                  y: Math.max(0, y),
                  z: getNextZ(state.widgets),
                }
              : widget,
          ),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, id),
          },
        })),
      resetLayout: () => set({ widgets: [], dockTree: createEmptyDockTree() }),
      closeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== id),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, id),
          },
        })),
    }),
    {
      name: "master_master_layout_v1",
      partialize: (state) => ({ widgets: state.widgets, dockTree: state.dockTree }),
    },
  ),
);
