import type { ReactNode } from "react";

export type SearchResultKind = "user" | "route" | "action";

export type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  kind: SearchResultKind;
  icon?: ReactNode;
  onSelect?: () => void | Promise<void>;
};

export type SearchProvider = {
  match: (query: string) => boolean;
  search: (query: string) => Promise<SearchResult[]>;
};
