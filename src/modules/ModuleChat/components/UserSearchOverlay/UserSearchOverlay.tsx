import { RiUserFollowLine, RiUserUnfollowLine } from "react-icons/ri";
import { AvatarCircle } from "../../../../shared/ui";
import { BaseActionButton } from "../../../../shared/ui";
import type { UserSearchItem } from "../../hooks/useUserSearch";
import "./UserSearchOverlay.css";

type UserSearchOverlayProps = {
  isOpen: boolean;
  items: UserSearchItem[];
  loading?: boolean;
  onSelectUser: (user: UserSearchItem) => void;
  onViewProfile: (user: UserSearchItem) => void;
  onFollowUser: (user: UserSearchItem) => void;
  isUserFollowed?: (userId: string) => boolean;
  onClose: () => void;
};

export function UserSearchOverlay({
  isOpen,
  items,
  loading,
  onSelectUser,
  onViewProfile,
  onFollowUser,
  isUserFollowed,
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
                <span className="user-search-actions" data-no-drag="true">
                  <BaseActionButton
                    label="Ver perfil"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onViewProfile(user);
                    }}
                  />
                  <BaseActionButton
                    label={isUserFollowed?.(user.id) ? "Unfollow" : "Seguir"}
                    icon={
                      isUserFollowed?.(user.id) ? (
                        <RiUserUnfollowLine size={14} />
                      ) : (
                        <RiUserFollowLine size={14} />
                      )
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onFollowUser(user);
                    }}
                  />
                </span>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
