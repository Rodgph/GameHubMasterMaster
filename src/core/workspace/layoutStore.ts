import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId, ModuleMode, WidgetHost } from "../modules/types";
import {
  createEmptyDockTree,
  createLeaf,
  insertAsTabAtLeaf,
  insertSplitAtLeaf,
  insertTabIntoLeafById,
  moveTabWithinLeaf,
  moveLeafToSplit,
  removeTabFromLeaf,
  removeLeafByWidgetId,
  splitRoot,
  updateLeafActive,
  updateSplitRatio,
} from "./dockTree";
import type { DockTree } from "./dockTree";
import { moduleRegistryById } from "../modules/registry";
import { isTauri } from "../platform/isTauri";
import { closeWindow, openWidgetWindow } from "../platform/tauriWindows";

export type DockEdge = "left" | "right" | "top" | "bottom";

export type WidgetLayout = {
  id: string;
  moduleId: ModuleId;
  mode: ModuleMode;
  host?: WidgetHost;
  windowLabel?: string;
  pinned?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type LayoutState = {
  widgets: WidgetLayout[];
  dockTree: DockTree;
  moduleRuntimeStateByWidgetId: Record<string, unknown>;
  windowBackgroundModeByWidgetId: Record<string, boolean>;
  addWidget: (moduleId: ModuleId) => void;
  duplicateWidget: (widgetId: string) => void;
  togglePinWidget: (widgetId: string) => void;
  reattachWidgetToDock: (widgetId: string) => Promise<void>;
  ensureModuleDocked: (moduleId: ModuleId) => void;
  closeWidgetsByModule: (moduleId: ModuleId) => void;
  applyEnabledModules: (enabledMap: Record<string, boolean>) => void;
  setWidgetRuntimeState: (widgetId: string, state: unknown) => void;
  clearWidgetRuntimeState: (widgetId: string) => void;
  setWindowBackgroundMode: (widgetId: string, isBackground: boolean) => void;
  closeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<WidgetLayout>) => void;
  bringToFront: (id: string) => void;
  dockWidget: (id: string, edge: DockEdge) => void;
  dockIntoLeaf: (id: string, targetLeafWidgetId: string, side: DockEdge) => void;
  dockAsTab: (movingId: string, targetWidgetId: string) => void;
  setActiveDockTab: (leafId: string, widgetId: string) => void;
  closeDockTab: (leafId: string, widgetId: string) => void;
  reorderDockTab: (leafId: string, widgetId: string, toIndex: number) => void;
  detachDockTab: (leafId: string, widgetId: string) => void;
  attachDockTabToLeaf: (leafId: string, widgetId: string, index?: number) => void;
  moveDockedWidget: (movingId: string, targetId: string, side: DockEdge) => void;
  setDockSplitRatio: (splitId: string, ratio: number) => void;
  undockWidget: (id: string) => void;
  undockWidgetAt: (id: string, x: number, y: number) => void;
  spawnWidgetWindow: (widgetId: string) => Promise<void>;
  closeWidgetWindow: (widgetId: string) => Promise<void>;
  detachDockTabToWindow: (
    originLeafId: string,
    tabId: string,
    x: number,
    y: number,
  ) => Promise<void>;
  resetLayout: () => void;
};

function getNextZ(widgets: WidgetLayout[]) {
  return widgets.reduce((max, widget) => Math.max(max, widget.z), 0) + 1;
}

function clampWidget(widget: WidgetLayout): WidgetLayout {
  const module = moduleRegistryById[widget.moduleId];
  if (!module) {
    return widget;
  }
  const constraints = module.widgetConstraints;
  return {
    ...widget,
    w: Math.max(widget.w, constraints.minWidth),
    h: Math.max(widget.h, constraints.minHeight ?? 600),
  };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: [],
      dockTree: createEmptyDockTree(),
      moduleRuntimeStateByWidgetId: {},
      windowBackgroundModeByWidgetId: {},
      addWidget: (moduleId) =>
        set((state) => {
          const constraints = moduleRegistryById[moduleId].widgetConstraints;
          const baseX = 80 + state.widgets.length * 24;
          const baseY = 80 + state.widgets.length * 24;
          const widget: WidgetLayout = {
            id: crypto.randomUUID(),
            moduleId,
            mode: "widget",
            host: "dom",
            x: baseX,
            y: baseY,
            w: Math.max(520, constraints.minWidth),
            h: Math.max(620, constraints.minHeight ?? 600),
            z: getNextZ(state.widgets),
          };
          return { widgets: [...state.widgets, widget] };
        }),
      duplicateWidget: (widgetId) =>
        set((state) => {
          const source = state.widgets.find((widget) => widget.id === widgetId);
          if (!source) return state;
          const duplicated: WidgetLayout = {
            ...source,
            id: crypto.randomUUID(),
            x: source.x + 24,
            y: source.y + 24,
            z: getNextZ(state.widgets),
          };
          return { widgets: [...state.widgets, duplicated] };
        }),
      togglePinWidget: (widgetId) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === widgetId ? { ...widget, pinned: !widget.pinned } : widget,
          ),
        })),
      reattachWidgetToDock: async (widgetId) => {
        const state = get();
        const current = state.widgets.find((widget) => widget.id === widgetId);
        if (!current) return;

        if (current.mode === "dock") return;
        const firstDockedWidget = state.widgets.find(
          (widget) => widget.mode === "dock" && widget.id !== widgetId,
        );
        if (firstDockedWidget) {
          get().dockAsTab(widgetId, firstDockedWidget.id);
        } else {
          get().dockWidget(widgetId, "right");
        }
      },
      ensureModuleDocked: (moduleId) =>
        set((state) => {
          const existing = state.widgets.find((widget) => widget.moduleId === moduleId);
          if (existing?.mode === "dock") return state;
          if (existing?.mode === "widget") {
            const direction: "row" = "row";
            const position: "end" = "end";
            const leaf = createLeaf(existing.id);
            return {
              widgets: state.widgets.map((widget) =>
                widget.id === existing.id ? { ...widget, mode: "dock" } : widget,
              ),
              dockTree: splitRoot(state.dockTree, direction, leaf, position),
            };
          }

          const constraints = moduleRegistryById[moduleId].widgetConstraints;
          const widgetId = crypto.randomUUID();
          const widget: WidgetLayout = {
            id: widgetId,
            moduleId,
            mode: "dock",
            host: "dom",
            x: 80,
            y: 80,
            w: Math.max(520, constraints.minWidth),
            h: Math.max(620, constraints.minHeight ?? 600),
            z: getNextZ(state.widgets),
          };
          const leaf = createLeaf(widgetId);
          return {
            widgets: [...state.widgets, widget],
            dockTree: splitRoot(state.dockTree, "row", leaf, "end"),
          };
        }),
      closeWidgetsByModule: (moduleId) =>
        set((state) => {
          const idsToRemove = state.widgets
            .filter((widget) => widget.moduleId === moduleId)
            .map((widget) => widget.id);

          let nextRoot = state.dockTree.root;
          for (const id of idsToRemove) {
            nextRoot = removeLeafByWidgetId(nextRoot, id);
          }

          return {
            widgets: state.widgets.filter((widget) => widget.moduleId !== moduleId),
            dockTree: { root: nextRoot },
            moduleRuntimeStateByWidgetId: Object.fromEntries(
              Object.entries(state.moduleRuntimeStateByWidgetId).filter(
                ([widgetId]) => !idsToRemove.includes(widgetId),
              ),
            ),
          };
        }),
      applyEnabledModules: (enabledMap) =>
        set((state) => {
          const toRemove = state.widgets.filter((widget) => {
            if (widget.moduleId === "welcome") {
              return enabledMap.welcome === false;
            }
            return enabledMap[widget.moduleId] === false;
          });

          for (const widget of toRemove) {
            if (widget.windowLabel && isTauri) {
              void closeWindow(widget.windowLabel);
            }
          }

          let nextRoot = state.dockTree.root;
          for (const widget of toRemove) {
            nextRoot = removeLeafByWidgetId(nextRoot, widget.id);
          }

          const removeIds = new Set(toRemove.map((widget) => widget.id));
          return {
            widgets: state.widgets.filter((widget) => !removeIds.has(widget.id)),
            dockTree: { root: nextRoot },
            moduleRuntimeStateByWidgetId: Object.fromEntries(
              Object.entries(state.moduleRuntimeStateByWidgetId).filter(
                ([widgetId]) => !removeIds.has(widgetId),
              ),
            ),
          };
        }),
      setWidgetRuntimeState: (widgetId, runtimeState) =>
        set((state) => ({
          moduleRuntimeStateByWidgetId: {
            ...state.moduleRuntimeStateByWidgetId,
            [widgetId]: runtimeState,
          },
        })),
      clearWidgetRuntimeState: (widgetId) =>
        set((state) => ({
          moduleRuntimeStateByWidgetId: Object.fromEntries(
            Object.entries(state.moduleRuntimeStateByWidgetId).filter(([id]) => id !== widgetId),
          ),
        })),
      setWindowBackgroundMode: (widgetId, isBackground) =>
        set((state) => ({
          windowBackgroundModeByWidgetId: {
            ...state.windowBackgroundModeByWidgetId,
            [widgetId]: isBackground,
          },
        })),
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
      dockAsTab: (movingId, targetWidgetId) =>
        set((state) => {
          const movingWidget = state.widgets.find((widget) => widget.id === movingId);
          if (!movingWidget) return state;

          const cleanedRoot = removeLeafByWidgetId(state.dockTree.root, movingId);
          const nextRoot = insertAsTabAtLeaf(cleanedRoot, targetWidgetId, movingId) ?? cleanedRoot;
          if (nextRoot === cleanedRoot) return state;

          return {
            widgets: state.widgets.map((widget) =>
              widget.id === movingId ? { ...widget, mode: "dock" } : widget,
            ),
            dockTree: {
              root: nextRoot,
            },
          };
        }),
      setActiveDockTab: (leafId, widgetId) =>
        set((state) => ({
          dockTree: {
            root: updateLeafActive(state.dockTree.root, leafId, widgetId),
          },
        })),
      closeDockTab: (_leafId, widgetId) =>
        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== widgetId),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, widgetId),
          },
        })),
      reorderDockTab: (leafId, widgetId, toIndex) =>
        set((state) => ({
          dockTree: {
            root: moveTabWithinLeaf(state.dockTree.root, leafId, widgetId, toIndex),
          },
        })),
      detachDockTab: (leafId, widgetId) =>
        set((state) => ({
          dockTree: {
            root: removeTabFromLeaf(state.dockTree.root, leafId, widgetId),
          },
        })),
      attachDockTabToLeaf: (leafId, widgetId, index) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === widgetId ? { ...widget, mode: "dock" } : widget,
          ),
          dockTree: {
            root: insertTabIntoLeafById(state.dockTree.root, leafId, widgetId, index),
          },
        })),
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
                  host: "dom",
                  windowLabel: undefined,
                  x: 80,
                  y: 80,
                  z: getNextZ(state.widgets),
                }
              : widget,
          ),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, id),
          },
          moduleRuntimeStateByWidgetId: Object.fromEntries(
            Object.entries(state.moduleRuntimeStateByWidgetId).filter(
              ([widgetId]) => widgetId !== id,
            ),
          ),
        })),
      undockWidgetAt: (id, x, y) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? {
                  ...widget,
                  mode: "widget",
                  host: "dom",
                  windowLabel: undefined,
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
      spawnWidgetWindow: async (widgetId) => {
        const widget = get().widgets.find((entry) => entry.id === widgetId);
        if (!widget || !isTauri) return;
        const windowLabel = `w_${widgetId}`;

        set((state) => ({
          widgets: state.widgets.map((entry) =>
            entry.id === widgetId
              ? {
                  ...entry,
                  mode: "widget",
                  host: "tauri",
                  windowLabel,
                }
              : entry,
          ),
        }));

        await openWidgetWindow(windowLabel, widgetId, widget.moduleId);
      },
      closeWidgetWindow: async (widgetId) => {
        const widget = get().widgets.find((entry) => entry.id === widgetId);
        if (!widget) return;

        if (widget.windowLabel && isTauri) {
          await closeWindow(widget.windowLabel);
        }

        set((state) => ({
          widgets: state.widgets.map((entry) =>
            entry.id === widgetId
              ? {
                  ...entry,
                  host: "dom",
                  windowLabel: undefined,
                }
              : entry,
          ),
        }));
      },
      detachDockTabToWindow: async (originLeafId, tabId, x, y) => {
        get().detachDockTab(originLeafId, tabId);
        if (isTauri) {
          await get().spawnWidgetWindow(tabId);
          return;
        }
        get().undockWidgetAt(tabId, x, y);
      },
      resetLayout: () =>
        set({
          widgets: [],
          dockTree: createEmptyDockTree(),
          moduleRuntimeStateByWidgetId: {},
          windowBackgroundModeByWidgetId: {},
        }),
      closeWidget: (id) => {
        const widget = get().widgets.find((entry) => entry.id === id);
        if (widget?.windowLabel && isTauri) {
          void closeWindow(widget.windowLabel);
        }

        set((state) => ({
          widgets: state.widgets.filter((entry) => entry.id !== id),
          dockTree: {
            root: removeLeafByWidgetId(state.dockTree.root, id),
          },
          moduleRuntimeStateByWidgetId: Object.fromEntries(
            Object.entries(state.moduleRuntimeStateByWidgetId).filter(
              ([widgetId]) => widgetId !== id,
            ),
          ),
        }));
      },
    }),
    {
      name: "master_master_layout_v1",
      partialize: (state) => ({ widgets: state.widgets, dockTree: state.dockTree }),
      merge: (persistedState, currentState) => {
        const typed = persistedState as Partial<LayoutState> | undefined;
        const persistedWidgets = (typed?.widgets ?? currentState.widgets).filter(
          (widget) => Boolean(moduleRegistryById[widget.moduleId]),
        );
        return {
          ...currentState,
          ...typed,
          widgets: persistedWidgets.map((widget) =>
            !widget.host || (!isTauri && widget.host === "tauri")
              ? { ...widget, host: "dom", windowLabel: undefined }
              : widget,
          ),
        };
      },
    },
  ),
);
