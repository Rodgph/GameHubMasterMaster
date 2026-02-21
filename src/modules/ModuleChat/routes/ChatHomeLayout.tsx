import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FiBell, FiBellOff, FiMail, FiStar, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { ModuleHeader, SettingsMenuOverlay, UserSearchOverlay } from "../components";
import { useUserSearch, type UserSearchItem } from "../hooks/useUserSearch";
import {
  addOpenConversation,
  getOpenConversations,
  markRead,
  markUnread,
  removeOpenConversation,
  toggleMuted,
  togglePinned,
} from "../utils/openConversations";
import { ContextMenuItem, ContextMenuOverlay } from "../../../shared/ui";
import { ChatHomeRoute } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  const navigate = useNavigate();
  const logout = useSessionStore((state) => state.logout);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openConversations, setOpenConversations] = useState(getOpenConversations);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const { users: searchUsers, loading: searchLoading } = useUserSearch(searchQuery);
  const contextConversation =
    contextUserId === null
      ? null
      : (openConversations.find((conversation) => conversation.userId === contextUserId) ?? null);

  const chatItems = useMemo(
    () =>
      [...openConversations]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
        })
        .map((conversation) => ({
          userId: conversation.userId,
          username: conversation.username,
          avatarUrl: conversation.avatarUrl,
          lastMessage: conversation.lastMessagePreview || "Toque para abrir a conversa",
        })),
    [openConversations],
  );

  const isSearchOpen = searchQuery.trim().length > 0;

  const handleSelectUser = (user: UserSearchItem) => {
    const conversation = {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatar_url ?? undefined,
      lastOpenedAt: new Date().toISOString(),
    };

    addOpenConversation(conversation);
    setOpenConversations(getOpenConversations());
    setSearchQuery("");
    setActiveSearchIndex(0);
    navigate(`/chat/u/${user.id}`);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen || searchUsers.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((prev) => Math.min(prev + 1, searchUsers.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = searchUsers[activeSearchIndex];
      if (target) handleSelectUser(target);
    }
  };

  const closeContextMenu = () => {
    setContextOpen(false);
    setContextUserId(null);
  };

  const handleRemoveConversation = () => {
    if (!contextUserId) return;
    const next = removeOpenConversation(contextUserId);
    setOpenConversations(next);
    closeContextMenu();
  };

  const handleTogglePinned = () => {
    if (!contextUserId) return;
    const next = togglePinned(contextUserId);
    setOpenConversations(next);
    closeContextMenu();
  };

  const handleToggleMuted = () => {
    if (!contextUserId) return;
    const next = toggleMuted(contextUserId);
    setOpenConversations(next);
    closeContextMenu();
  };

  const handleMarkUnread = () => {
    if (!contextUserId) return;
    const next = markUnread(contextUserId, 1);
    setOpenConversations(next);
    closeContextMenu();
  };

  return (
    <div className="chat-home-layout" data-no-drag="true">
      <ModuleHeader
        onSettingsClick={() => setSettingsOpen(true)}
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setActiveSearchIndex(0);
        }}
        onSearchKeyDown={handleSearchKeyDown}
      />
      <div className="chat-home-layout-content" data-no-drag="true">
        <ChatHomeRoute
          items={chatItems}
          onOpenUserId={(userId) => {
            const next = markRead(userId);
            setOpenConversations(next);
            navigate(`/chat/u/${userId}`);
          }}
          onOpenContextMenu={({ x, y, userId }) => {
            setContextX(x);
            setContextY(y);
            setContextUserId(userId);
            setContextOpen(true);
          }}
        />
      </div>
      <UserSearchOverlay
        isOpen={isSearchOpen}
        items={searchUsers}
        loading={searchLoading}
        onSelectUser={handleSelectUser}
        onClose={() => setSearchQuery("")}
      />
      <SettingsMenuOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onMyAccount={() => navigate("/chat/account")}
        onChatSettings={() => navigate("/chat/settings")}
        onLogout={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      />
      <ContextMenuOverlay isOpen={contextOpen} x={contextX} y={contextY} onClose={closeContextMenu}>
        <ContextMenuItem
          label={contextConversation?.pinned ? "Desafixar conversa" : "Fixar conversa"}
          icon={<FiStar size={16} />}
          onClick={handleTogglePinned}
        />
        <ContextMenuItem
          label={contextConversation?.muted ? "Ativar notificacoes" : "Silenciar"}
          icon={contextConversation?.muted ? <FiBellOff size={16} /> : <FiBell size={16} />}
          onClick={handleToggleMuted}
        />
        <ContextMenuItem
          label="Marcar como nao lida"
          icon={<FiMail size={16} />}
          onClick={handleMarkUnread}
        />
        <div className="chat-context-divider" />
        <ContextMenuItem
          label="Remover conversa"
          icon={<FiTrash2 size={16} />}
          onClick={handleRemoveConversation}
        />
      </ContextMenuOverlay>
    </div>
  );
}
