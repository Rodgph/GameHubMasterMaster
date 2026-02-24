import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId, ModuleMode, WidgetHost } from "../modules/types";
import { moduleRegistryById } from "../modules/registry";
import { isTauri } from "../platform/isTauri";
import { closeWindow, openWidgetWindow } from "../platform/tauriWindows";

export type WidgetInstance = {
  id: string;
  moduleId: ModuleId;
  mode: ModuleMode;
  host?: WidgetHost;
  windowLabel?: string;
  pinned?: boolean;
};

type LayoutState = {
  widgetsById: Record<string, WidgetInstance>;
  widgetOrder: string[];
  moduleRuntimeStateByWidgetId: Record<string, unknown>;
  windowBackgroundModeByWidgetId: Record<string, boolean>;
  addWidget: (moduleId: ModuleId) => void;
  ensureModuleDocked: (moduleId: ModuleId) => void;
  closeWidgetsByModule: (moduleId: ModuleId) => void;
  applyEnabledModules: (enabledMap: Record<string, boolean>) => void;
  removeWidget: (widgetId: string) => void;
  setWidgetRuntimeState: (widgetId: string, state: unknown) => void;
  clearWidgetRuntimeState: (widgetId: string) => void;
  setWindowBackgroundMode: (widgetId: string, isBackground: boolean) => void;
  closeWidget: (widgetId: string) => void;
  spawnWidgetWindow: (widgetId: string) => Promise<void>;
  closeWidgetWindow: (widgetId: string) => Promise<void>;
  resetLayout: () => void;
};

function createWidgetInstance(moduleId: ModuleId): WidgetInstance {
  return {
    id: crypto.randomUUID(),
    moduleId,
    mode: "dock",
    host: "dom",
  };
}

function sanitizeWidgetsById(input: Record<string, WidgetInstance>): Record<string, WidgetInstance> {
  const next: Record<string, WidgetInstance> = {};
  for (const [id, widget] of Object.entries(input)) {
    if (!moduleRegistryById[widget.moduleId]) continue;
    next[id] = {
      ...widget,
      id,
      mode: widget.mode ?? "dock",
      host: widget.host ?? "dom",
    };
  }
  return next;
}

function sanitizeWidgetOrder(order: string[], widgetsById: Record<string, WidgetInstance>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const widgetId of order) {
    if (!widgetsById[widgetId] || seen.has(widgetId)) continue;
    seen.add(widgetId);
    result.push(widgetId);
  }

  for (const widgetId of Object.keys(widgetsById)) {
    if (seen.has(widgetId)) continue;
    seen.add(widgetId);
    result.push(widgetId);
  }

  return result;
}

function removeWidgetState(
  state: Pick<
    LayoutState,
    "widgetsById" | "widgetOrder" | "moduleRuntimeStateByWidgetId" | "windowBackgroundModeByWidgetId"
  >,
  widgetId: string,
): Pick<
  LayoutState,
  "widgetsById" | "widgetOrder" | "moduleRuntimeStateByWidgetId" | "windowBackgroundModeByWidgetId"
> {
  if (!state.widgetsById[widgetId]) {
    return state;
  }

  const widgetsById = { ...state.widgetsById };
  delete widgetsById[widgetId];

  return {
    widgetsById,
    widgetOrder: state.widgetOrder.filter((id) => id !== widgetId),
    moduleRuntimeStateByWidgetId: Object.fromEntries(
      Object.entries(state.moduleRuntimeStateByWidgetId).filter(([id]) => id !== widgetId),
    ),
    windowBackgroundModeByWidgetId: Object.fromEntries(
      Object.entries(state.windowBackgroundModeByWidgetId).filter(([id]) => id !== widgetId),
    ),
  };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgetsById: {},
      widgetOrder: [],
      moduleRuntimeStateByWidgetId: {},
      windowBackgroundModeByWidgetId: {},
      addWidget: (moduleId) =>
        set((state) => {
          const widget = createWidgetInstance(moduleId);
          const widgetsById = sanitizeWidgetsById({
            ...state.widgetsById,
            [widget.id]: widget,
          });

          return {
            widgetsById,
            widgetOrder: sanitizeWidgetOrder([...state.widgetOrder, widget.id], widgetsById),
          };
        }),
      ensureModuleDocked: (moduleId) =>
        set((state) => {
          const existing = Object.values(state.widgetsById).find(
            (widget) => widget.moduleId === moduleId && widget.host !== "tauri",
          );
          if (existing) return state;

          const widget = createWidgetInstance(moduleId);
          const widgetsById = sanitizeWidgetsById({
            ...state.widgetsById,
            [widget.id]: widget,
          });

          return {
            widgetsById,
            widgetOrder: sanitizeWidgetOrder([...state.widgetOrder, widget.id], widgetsById),
          };
        }),
      closeWidgetsByModule: (moduleId) => {
        const current = get();
        const ids = Object.values(current.widgetsById)
          .filter((widget) => widget.moduleId === moduleId)
          .map((widget) => widget.id);

        for (const id of ids) {
          current.removeWidget(id);
        }
      },
      applyEnabledModules: (enabledMap) => {
        const current = get();
        const ids = Object.values(current.widgetsById)
          .filter((widget) => {
            if (widget.moduleId === "welcome") {
              return enabledMap.welcome === false;
            }
            return enabledMap[widget.moduleId] === false;
          })
          .map((widget) => widget.id);

        for (const id of ids) {
          current.removeWidget(id);
        }
      },
      removeWidget: (widgetId) => {
        const widget = get().widgetsById[widgetId];
        if (widget?.windowLabel && isTauri) {
          void closeWindow(widget.windowLabel);
        }

        set((state) => removeWidgetState(state, widgetId));
      },
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
      closeWidget: (widgetId) => {
        get().removeWidget(widgetId);
      },
      spawnWidgetWindow: async (widgetId) => {
        const current = get();
        const widget = current.widgetsById[widgetId];
        if (!widget || !isTauri) return;

        const windowLabel = `w_${widgetId}`;
        set((state) => {
          if (!state.widgetsById[widgetId]) return state;
          return {
            widgetsById: sanitizeWidgetsById({
              ...state.widgetsById,
              [widgetId]: {
                ...state.widgetsById[widgetId],
                mode: "widget",
                host: "tauri",
                windowLabel,
              },
            }),
          };
        });

        await openWidgetWindow(windowLabel, widgetId, widget.moduleId);
      },
      closeWidgetWindow: async (widgetId) => {
        const current = get();
        const widget = current.widgetsById[widgetId];
        if (!widget) return;

        if (widget.windowLabel && isTauri) {
          await closeWindow(widget.windowLabel);
        }

        set((state) => {
          if (!state.widgetsById[widgetId]) return state;
          return {
            widgetsById: sanitizeWidgetsById({
              ...state.widgetsById,
              [widgetId]: {
                ...state.widgetsById[widgetId],
                mode: "dock",
                host: "dom",
                windowLabel: undefined,
              },
            }),
          };
        });
      },
      resetLayout: () =>
        set(() => ({
          widgetsById: {},
          widgetOrder: [],
          moduleRuntimeStateByWidgetId: {},
          windowBackgroundModeByWidgetId: {},
        })),
    }),
    {
      name: "master_master_layout_v1",
      partialize: (state) => ({
        widgetsById: state.widgetsById,
        widgetOrder: state.widgetOrder,
      }),
      merge: (persistedState, currentState) => {
        const typed = persistedState as
          | {
              widgetsById?: Record<string, WidgetInstance>;
              widgetOrder?: string[];
              widgets?: Array<WidgetInstance & { id: string }>;
            }
          | undefined;

        const fromRecord = typed?.widgetsById;
        const fromArray = typed?.widgets;
        const rawWidgetsById = fromRecord
          ? fromRecord
          : Object.fromEntries((fromArray ?? []).map((widget) => [widget.id, widget]));
        const rawOrder = typed?.widgetOrder ?? fromArray?.map((widget) => widget.id) ?? [];

        const widgetsById = sanitizeWidgetsById(rawWidgetsById);
        const widgetOrder = sanitizeWidgetOrder(rawOrder, widgetsById);

        return {
          ...currentState,
          widgetsById,
          widgetOrder,
          moduleRuntimeStateByWidgetId: currentState.moduleRuntimeStateByWidgetId,
          windowBackgroundModeByWidgetId: currentState.windowBackgroundModeByWidgetId,
        };
      },
    },
  ),
);
