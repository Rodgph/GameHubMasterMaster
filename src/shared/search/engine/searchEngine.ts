import type { SearchProvider, SearchResult } from "./types";

const MAX_RESULTS = 20;

export function createSearchEngine(providers: SearchProvider[]) {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const runnable = providers.filter((provider) => provider.match(query));
      const settled = await Promise.all(runnable.map((provider) => provider.search(query)));
      const merged = settled.flat();

      const sorted = query.trim().startsWith("@")
        ? merged.sort((a, b) => {
            if (a.kind === b.kind) return 0;
            if (a.kind === "user") return -1;
            if (b.kind === "user") return 1;
            return 0;
          })
        : merged;

      return sorted.slice(0, MAX_RESULTS);
    },
  };
}
