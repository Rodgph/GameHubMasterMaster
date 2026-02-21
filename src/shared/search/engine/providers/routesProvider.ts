import type { SearchProvider, SearchResult } from "../types";

type RoutesProviderDeps = {
  onNavigate: (path: string) => void;
};

const routeItems = [
  { id: "route:home", title: "Workspace", subtitle: "Abrir inicio", path: "/" },
  { id: "route:chat", title: "Chat", subtitle: "Abrir chat", path: "/chat" },
  { id: "route:chat-favs", title: "Favoritos", subtitle: "Abrir favoritos", path: "/chat/favs" },
  {
    id: "route:chat-settings",
    title: "Configuracoes do chat",
    subtitle: "Abrir configuracoes",
    path: "/chat/settings",
  },
  {
    id: "route:chat-account",
    title: "Minha conta",
    subtitle: "Abrir perfil",
    path: "/chat/account",
  },
];

export function createRoutesProvider({ onNavigate }: RoutesProviderDeps): SearchProvider {
  return {
    match: (query) => !query.trim().startsWith("@"),
    search: async (query) => {
      const needle = query.trim().toLowerCase();
      const filtered = needle
        ? routeItems.filter((item) =>
            `${item.title} ${item.subtitle}`.toLowerCase().includes(needle),
          )
        : routeItems;

      return filtered.map<SearchResult>((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        kind: "route",
        onSelect: () => onNavigate(item.path),
      }));
    },
  };
}
