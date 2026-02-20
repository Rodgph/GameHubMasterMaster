import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId, ModuleMode } from "../modules/types";
import { createEmptyDockTree } from "./dockTree";
import type { DockTree } from "./dockTree";
import { moduleRegistryById } from "../modules/registry";

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
      closeWidget: (id) =>
        set((state) => ({ widgets: state.widgets.filter((widget) => widget.id !== id) })),
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
      resetLayout: () => set({ widgets: [], dockTree: createEmptyDockTree() }),
    }),
    {
      name: "master_master_layout_v1",
      partialize: (state) => ({ widgets: state.widgets, dockTree: state.dockTree }),
    },
  ),
);
