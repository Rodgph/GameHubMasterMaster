import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FiBell, FiBellOff, FiMail, FiStar, FiTrash2 } from "react-icons/fi";
import { RiUserFollowLine, RiUserUnfollowLine } from "react-icons/ri";
import { useLocation, useNavigate } from "react-router-dom";
import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { followUser, unfollowUser } from "../data/follows.repository";
import { listActiveStoriesByUserIds } from "../data/stories.repository";
import { FloatingCreateMenu, ModuleHeader, SettingsMenuOverlay, UserSearchOverlay } from "../components";
import { useFollowedProfiles } from "../hooks/useFollowedProfiles";
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
import { ChatHomeRoute } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useSessionStore((state) => state.logout);
  const currentUser = useSessionStore((state) => state.user);
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openConversations, setOpenConversations] = useState(getOpenConversations);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const { users: searchUsers, loading: searchLoading } = useUserSearch(searchQuery);
  const { profiles: followedProfiles, refresh: refreshFollowedProfiles } = useFollowedProfiles();
  const [storyUserIds, setStoryUserIds] = useState<Set<string>>(new Set());
  const followedIds = useMemo(() => new Set(followedProfiles.map((item) => item.id)), [followedProfiles]);
  useEffect(() => {
    let active = true;
    const run = async () => {
      const storyOwners = [
        ...new Set(
          [
            ...followedProfiles.map((item) => item.id),
            ...(currentUserId ? [currentUserId] : []),
          ].filter(Boolean),
        ),
      ];

      if (storyOwners.length === 0) {
        setStoryUserIds(new Set());
        return;
      }
      try {
        const activeStories = await listActiveStoriesByUserIds(storyOwners);
        if (!active) return;
        setStoryUserIds(new Set(activeStories.map((story) => story.user_id)));
      } catch {
        if (!active) return;
        setStoryUserIds(new Set());
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [currentUserId, followedProfiles, location.pathname]);

  const contextConversation =
    contextUserId === null
      ? null
      : (openConversations.find((conversation) => conversation.userId === contextUserId) ?? null);
  const stories = useMemo(
    () => {
      const followedStories = followedProfiles
        .filter((item) => storyUserIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.username,
          avatar: item.avatar_url,
        }));

      if (!currentUserId || !storyUserIds.has(currentUserId)) {
        return followedStories;
      }

      return [
        {
          id: currentUserId,
          name: currentUser?.username || "Voce",
          avatar: currentUser?.avatar_url,
        },
        ...followedStories.filter((item) => item.id !== currentUserId),
      ];
    },
    [currentUser, currentUserId, followedProfiles, storyUserIds],
  );

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

  const handleFollowUser = async (targetUserId: string) => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    try {
      await followUser({ followerId: currentUserId, followedId: targetUserId });
      await refreshFollowedProfiles();
    } catch {
      // keep silent for now; follow action is best-effort
    }
  };

  const handleUnfollowUser = async (targetUserId: string) => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    try {
      await unfollowUser({ followerId: currentUserId, followedId: targetUserId });
      await refreshFollowedProfiles();
    } catch {
      // keep silent for now; unfollow action is best-effort
    }
  };

  const handleFollowFromContext = async () => {
    if (!contextUserId) return;
    if (followedIds.has(contextUserId)) {
      await handleUnfollowUser(contextUserId);
    } else {
      await handleFollowUser(contextUserId);
    }
    closeContextMenu();
  };
  const contextItems = useMemo<ContextMenuBaseItem[]>(
    () => [
      {
        id: "pin",
        label: contextConversation?.pinned ? "Desafixar conversa" : "Fixar conversa",
        icon: <FiStar size={16} />,
        onClick: handleTogglePinned,
      },
      {
        id: "mute",
        label: contextConversation?.muted ? "Ativar notificacoes" : "Silenciar",
        icon: contextConversation?.muted ? <FiBellOff size={16} /> : <FiBell size={16} />,
        onClick: handleToggleMuted,
      },
      {
        id: "follow",
        label: contextUserId && followedIds.has(contextUserId) ? "Deixar de seguir" : "Seguir",
        icon:
          contextUserId && followedIds.has(contextUserId) ? (
            <RiUserUnfollowLine size={16} />
          ) : (
            <RiUserFollowLine size={16} />
          ),
        onClick: handleFollowFromContext,
      },
      {
        id: "unread",
        label: "Marcar como nao lida",
        icon: <FiMail size={16} />,
        onClick: handleMarkUnread,
      },
      { id: "divider", label: "", kind: "divider" },
      {
        id: "remove",
        label: "Remover conversa",
        icon: <FiTrash2 size={16} />,
        onClick: handleRemoveConversation,
      },
    ],
    [
      contextConversation?.muted,
      contextConversation?.pinned,
      contextUserId,
      followedIds,
      handleFollowFromContext,
      handleMarkUnread,
      handleRemoveConversation,
      handleToggleMuted,
      handleTogglePinned,
    ],
  );

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
        stories={stories}
        onOpenStory={(storyId) => navigate(`/chat/story/${storyId}`)}
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
            // Force-close any other open context menu layers (e.g. workspace Radix menu)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
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
        onViewProfile={(user) => {
          setSearchQuery("");
          setActiveSearchIndex(0);
          navigate(`/chat/profile/${user.id}`);
        }}
        onFollowUser={async (user) => {
          if (followedIds.has(user.id)) {
            await handleUnfollowUser(user.id);
          } else {
            await handleFollowUser(user.id);
          }
          setSearchQuery("");
          setActiveSearchIndex(0);
        }}
        isUserFollowed={(userId) => followedIds.has(userId)}
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
      <ContextMenuBase
        open={contextOpen}
        anchorPoint={{ x: contextX, y: contextY }}
        onClose={closeContextMenu}
        items={contextItems}
        dividerClassName="chat-context-divider"
      />
      <FloatingCreateMenu
        onCreateStory={() => navigate("/chat/story/create")}
        onCreateGroup={() => navigate("/chat/group/create")}
        onCreateServer={() => navigate("/chat/server/create")}
      />
    </div>
  );
}
