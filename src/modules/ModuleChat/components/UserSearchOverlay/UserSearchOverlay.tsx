import { AvatarCircle } from "../../../../shared/ui";
import type { UserSearchItem } from "../../hooks/useUserSearch";
import "./UserSearchOverlay.css";

type UserSearchOverlayProps = {
  isOpen: boolean;
  items: UserSearchItem[];
  loading?: boolean;
  onSelectUser: (user: UserSearchItem) => void;
  onClose: () => void;
};

export function UserSearchOverlay({
  isOpen,
  items,
  loading,
  onSelectUser,
  onClose,
}: UserSearchOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="user-search-overlay" data-no-drag="true" onClick={onClose}>
      <div
        className="user-search-panel"
        data-no-drag="true"
        onClick={(event) => event.stopPropagation()}
      >
        {loading ? <div className="user-search-empty">Buscando...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="user-search-empty">Nenhum usuario encontrado</div>
        ) : null}
        {!loading
          ? items.map((user) => (
              <button
                key={user.id}
                type="button"
                className="user-search-item"
                onClick={() => onSelectUser(user)}
              >
                <AvatarCircle src={user.avatar_url ?? undefined} alt={user.username} size={36} />
                <span className="user-search-texts">
                  <span className="user-search-title">@{user.username}</span>
                  <span className="user-search-subtitle">Abrir conversa</span>
                </span>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
