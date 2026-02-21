import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { ModuleHeader, SettingsMenuOverlay, UserSearchOverlay } from "../components";
import { useUserSearch, type UserSearchItem } from "../hooks/useUserSearch";
import { addOpenConversation, getOpenConversations } from "../utils/openConversations";
import { ChatHomeRoute } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  const navigate = useNavigate();
  const logout = useSessionStore((state) => state.logout);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openConversations, setOpenConversations] = useState(getOpenConversations);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const { users: searchUsers, loading: searchLoading } = useUserSearch(searchQuery);

  const chatItems = useMemo(
    () =>
      openConversations.map((conversation) => ({
        userId: conversation.userId,
        username: conversation.username,
        avatarUrl: conversation.avatarUrl,
        lastMessage: "Toque para abrir a conversa",
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
            navigate(`/chat/u/${userId}`);
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
    </div>
  );
}
