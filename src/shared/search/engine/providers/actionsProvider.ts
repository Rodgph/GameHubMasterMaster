import type { SearchProvider, SearchResult } from "../types";

type ActionsProviderDeps = {
  onLogout: () => Promise<void>;
};

export function createActionsProvider({ onLogout }: ActionsProviderDeps): SearchProvider {
  const actions: SearchResult[] = [
    {
      id: "action:logout",
      title: "Deslogar",
      subtitle: "Encerrar sessao atual",
      kind: "action",
      onSelect: () => onLogout(),
    },
  ];

  return {
    match: (query) => !query.trim().startsWith("@"),
    search: async (query) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return actions;

      return actions.filter((item) =>
        `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(needle),
      );
    },
  };
}
