import type { SearchResult } from "../../engine/types";
import "./SearchResultItem.css";

type SearchResultItemProps = {
  item: SearchResult;
  active: boolean;
  onSelect: () => void;
};

export function SearchResultItem({ item, active, onSelect }: SearchResultItemProps) {
  return (
    <button
      type="button"
      className={`global-search-result-item${active ? " is-active" : ""}`}
      onClick={onSelect}
      data-no-drag="true"
    >
      <span className="global-search-result-kind">{item.kind}</span>
      <span className="global-search-result-content">
        <span className="global-search-result-title">{item.title}</span>
        {item.subtitle ? (
          <span className="global-search-result-subtitle">{item.subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}
