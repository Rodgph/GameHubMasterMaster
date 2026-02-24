import { create } from "zustand";
import type { ModuleId } from "../modules/types";

type SearchQueries = Partial<Record<ModuleId, string>>;

type WorkspaceSearchState = {
  isOpen: boolean;
  activeModuleId: ModuleId | null;
  queries: SearchQueries;
  openForModule: (moduleId: ModuleId | null) => void;
  close: () => void;
  setActiveQuery: (query: string) => void;
};

export function getWorkspaceSearchPlaceholder(moduleId: ModuleId | null): string {
  switch (moduleId) {
    case "chat":
      return "search @";
    case "music":
      return "search music";
    case "feed":
      return "search feed";
    default:
      return "search";
  }
}

export const useWorkspaceSearchStore = create<WorkspaceSearchState>((set) => ({
  isOpen: false,
  activeModuleId: null,
  queries: {},
  openForModule: (moduleId) =>
    set((state) => ({
      isOpen: true,
      activeModuleId: moduleId,
      queries: moduleId
        ? {
            ...state.queries,
            [moduleId]: "",
          }
        : state.queries,
    })),
  close: () =>
    set({
      isOpen: false,
      activeModuleId: null,
      queries: {},
    }),
  setActiveQuery: (query) =>
    set((state) => {
      if (!state.activeModuleId) return state;
      return {
        queries: {
          ...state.queries,
          [state.activeModuleId]: query,
        },
      };
    }),
}));
