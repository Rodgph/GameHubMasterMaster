import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId, ModuleMode, WidgetHost } from "../modules/types";
import { moduleRegistryById } from "../modules/registry";
import { isTauri } from "../platform/isTauri";
import { closeWindow, openWidgetWindow } from "../platform/tauriWindows";

export type WidgetLayout = {
  id: string;
  moduleId: ModuleId;
  mode: ModuleMode;
  host?: WidgetHost;
  windowLabel?: string;
  pinned?: boolean;
  parentId?: string;
  children?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type LayoutState = {
  widgets: WidgetLayout[];
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
  attachToNav: (childId: string, navId: string, index?: number) => void;
  detachFromNav: (childId: string) => void;
  spawnWidgetWindow: (widgetId: string) => Promise<void>;
  closeWidgetWindow: (widgetId: string) => Promise<void>;
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

function ensureNavChildren(widget: WidgetLayout) {
  if (widget.moduleId !== "nav") return widget;
  return {
    ...widget,
    children: widget.children ?? [],
  };
}

function normalizeNavLinks(widgets: WidgetLayout[]): WidgetLayout[] {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const withValidParents = widgets.map((widget) => {
    if (!widget.parentId) return widget;
    const parent = byId.get(widget.parentId);
    if (!parent || parent.moduleId !== "nav" || parent.id === widget.id) {
      return { ...widget, parentId: undefined };
    }
    return widget;
  });

  const childrenByParentId = new Map<string, string[]>();
  for (const widget of withValidParents) {
    if (!widget.parentId) continue;
    const list = childrenByParentId.get(widget.parentId) ?? [];
    list.push(widget.id);
    childrenByParentId.set(widget.parentId, list);
  }

  return withValidParents.map((widget) => {
    if (widget.moduleId !== "nav") {
      if (!widget.children) return widget;
      return { ...widget, children: undefined };
    }

    const linkedChildren = childrenByParentId.get(widget.id) ?? [];
    const linkedSet = new Set(linkedChildren);
    const orderedFromState = (widget.children ?? []).filter(
      (childId, index, source) => source.indexOf(childId) === index && linkedSet.has(childId),
    );
    const missing = linkedChildren.filter((childId) => !orderedFromState.includes(childId));
    return {
      ...widget,
      children: [...orderedFromState, ...missing],
    };
  });
}

function createWidget(moduleId: ModuleId, widgets: WidgetLayout[]): WidgetLayout {
  const constraints = moduleRegistryById[moduleId].widgetConstraints;
  const baseX = 80 + widgets.length * 24;
  const baseY = 80 + widgets.length * 24;
  return {
    id: crypto.randomUUID(),
    moduleId,
    mode: "dock",
    host: "dom",
    x: baseX,
    y: baseY,
    w: Math.max(520, constraints.minWidth),
    h: Math.max(620, constraints.minHeight ?? 600),
    z: getNextZ(widgets),
    children: moduleId === "nav" ? [] : undefined,
  };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: [],
      moduleRuntimeStateByWidgetId: {},
      windowBackgroundModeByWidgetId: {},
      addWidget: (moduleId) =>
        set((state) => ({
          widgets: normalizeNavLinks([...state.widgets, createWidget(moduleId, state.widgets)]),
        })),
      duplicateWidget: (widgetId) =>
        set((state) => {
          const source = state.widgets.find((widget) => widget.id === widgetId);
          if (!source) return state;
          const duplicated: WidgetLayout = {
            ...source,
            id: crypto.randomUUID(),
            parentId: undefined,
            children: source.moduleId === "nav" ? [] : undefined,
            x: source.x + 24,
            y: source.y + 24,
            z: getNextZ(state.widgets),
          };
          return { widgets: normalizeNavLinks([...state.widgets, duplicated]) };
        }),
      togglePinWidget: (widgetId) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === widgetId ? { ...widget, pinned: !widget.pinned } : widget,
          ),
        })),
      reattachWidgetToDock: async (widgetId) => {
        set((state) => ({
          widgets: normalizeNavLinks(
            state.widgets.map((widget) =>
              widget.id === widgetId
                ? {
                    ...widget,
                    mode: "dock",
                    host: "dom",
                    windowLabel: undefined,
                    parentId: undefined,
                  }
                : widget,
            ),
          ),
        }));
      },
      ensureModuleDocked: (moduleId) =>
        set((state) => {
          const existing = state.widgets.find((widget) => widget.moduleId === moduleId);
          if (existing) return state;
          return {
            widgets: normalizeNavLinks([...state.widgets, createWidget(moduleId, state.widgets)]),
          };
        }),
      closeWidgetsByModule: (moduleId) =>
        set((state) => {
          const toRemove = state.widgets.filter((widget) => widget.moduleId === moduleId);
          for (const widget of toRemove) {
            if (widget.windowLabel && isTauri) {
              void closeWindow(widget.windowLabel);
            }
          }

          const removeIds = new Set(toRemove.map((widget) => widget.id));
          const nextWidgets = normalizeNavLinks(
            state.widgets.filter((widget) => !removeIds.has(widget.id)),
          );

          return {
            widgets: nextWidgets,
            moduleRuntimeStateByWidgetId: Object.fromEntries(
              Object.entries(state.moduleRuntimeStateByWidgetId).filter(
                ([widgetId]) => !removeIds.has(widgetId),
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

          const removeIds = new Set(toRemove.map((widget) => widget.id));
          return {
            widgets: normalizeNavLinks(state.widgets.filter((widget) => !removeIds.has(widget.id))),
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
      closeWidget: (id) => {
        const widget = get().widgets.find((entry) => entry.id === id);
        if (widget?.windowLabel && isTauri) {
          void closeWindow(widget.windowLabel);
        }

        set((state) => ({
          widgets: normalizeNavLinks(state.widgets.filter((entry) => entry.id !== id)),
          moduleRuntimeStateByWidgetId: Object.fromEntries(
            Object.entries(state.moduleRuntimeStateByWidgetId).filter(
              ([widgetId]) => widgetId !== id,
            ),
          ),
        }));
      },
      updateWidget: (id, patch) =>
        set((state) => ({
          widgets: normalizeNavLinks(
            state.widgets.map((widget) =>
              widget.id === id ? clampWidget({ ...widget, ...patch }) : widget,
            ),
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
      attachToNav: (childId, navId, index) =>
        set((state) => {
          if (childId === navId) return state;
          const child = state.widgets.find((widget) => widget.id === childId);
          const nav = state.widgets.find((widget) => widget.id === navId);
          if (!child || !nav || nav.moduleId !== "nav") return state;

          const withoutChildInNavLists = state.widgets.map((widget) => {
            if (widget.moduleId !== "nav") return widget;
            const nextChildren = (widget.children ?? []).filter((id) => id !== childId);
            if ((widget.children ?? []).length === nextChildren.length) {
              return ensureNavChildren(widget);
            }
            return { ...widget, children: nextChildren };
          });

          const navAfterCleanup = withoutChildInNavLists.find((widget) => widget.id === navId);
          if (!navAfterCleanup || navAfterCleanup.moduleId !== "nav") return state;

          const nextChildren = [...(navAfterCleanup.children ?? [])];
          const insertIndex =
            index === undefined
              ? nextChildren.length
              : Math.max(0, Math.min(nextChildren.length, index));
          nextChildren.splice(insertIndex, 0, childId);

          return {
            widgets: normalizeNavLinks(
              withoutChildInNavLists.map((widget) => {
                if (widget.id === childId) {
                  return {
                    ...widget,
                    mode: "dock",
                    host: "dom",
                    windowLabel: undefined,
                    parentId: navId,
                  };
                }
                if (widget.id === navId) {
                  return { ...widget, children: nextChildren };
                }
                return widget;
              }),
            ),
          };
        }),
      detachFromNav: (childId) =>
        set((state) => {
          const child = state.widgets.find((widget) => widget.id === childId);
          if (!child?.parentId) return state;

          return {
            widgets: normalizeNavLinks(
              state.widgets.map((widget) => {
                if (widget.id === childId) {
                  return {
                    ...widget,
                    mode: "dock",
                    host: "dom",
                    windowLabel: undefined,
                    parentId: undefined,
                  };
                }
                if (widget.id === child.parentId && widget.moduleId === "nav") {
                  return {
                    ...widget,
                    children: (widget.children ?? []).filter((id) => id !== childId),
                  };
                }
                return widget;
              }),
            ),
          };
        }),
      spawnWidgetWindow: async (widgetId) => {
        const widget = get().widgets.find((entry) => entry.id === widgetId);
        if (!widget || !isTauri) return;
        const windowLabel = `w_${widgetId}`;

        set((state) => ({
          widgets: normalizeNavLinks(
            state.widgets.map((entry) =>
              entry.id === widgetId
                ? {
                    ...entry,
                    mode: "widget",
                    host: "tauri",
                    windowLabel,
                    parentId: undefined,
                  }
                : entry,
            ),
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
          widgets: normalizeNavLinks(
            state.widgets.map((entry) =>
              entry.id === widgetId
                ? {
                    ...entry,
                    mode: "dock",
                    host: "dom",
                    windowLabel: undefined,
                  }
                : entry,
            ),
          ),
        }));
      },
      resetLayout: () =>
        set({
          widgets: [],
          moduleRuntimeStateByWidgetId: {},
          windowBackgroundModeByWidgetId: {},
        }),
    }),
    {
      name: "master_master_layout_v1",
      partialize: (state) => ({ widgets: state.widgets }),
      merge: (persistedState, currentState) => {
        const typed = persistedState as Partial<LayoutState> | undefined;
        const persistedWidgets = (typed?.widgets ?? currentState.widgets).filter((widget) =>
          Boolean(moduleRegistryById[widget.moduleId]),
        );
        const validIds = new Set(persistedWidgets.map((widget) => widget.id));

        const hydratedWidgets = persistedWidgets.map((widget) => {
          const baseWidget =
            !widget.host || (!isTauri && widget.host === "tauri")
              ? {
                  ...widget,
                  host: "dom" as const,
                  windowLabel: undefined,
                }
              : widget;
          return {
            ...baseWidget,
            parentId:
              baseWidget.parentId && validIds.has(baseWidget.parentId)
                ? baseWidget.parentId
                : undefined,
            children: baseWidget.moduleId === "nav" ? baseWidget.children ?? [] : undefined,
          };
        });

        return {
          ...currentState,
          ...typed,
          widgets: normalizeNavLinks(hydratedWidgets.map(ensureNavChildren)),
          moduleRuntimeStateByWidgetId: currentState.moduleRuntimeStateByWidgetId,
          windowBackgroundModeByWidgetId: currentState.windowBackgroundModeByWidgetId,
        };
      },
    },
  ),
);
