import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";
import { cloudRealtimeWsUrl } from "../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../core/services/supabase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { FiBell, FiBellOff, FiMail, FiStar, FiTrash2, RiUserFollowLine, RiUserUnfollowLine } from "../../../shared/ui/icons";
import { useChatStore } from "../chatStore";
import { CreateGroupOverlay, FloatingCreateMenu, ModuleHeader, SettingsMenuOverlay, UserSearchOverlay } from "../components";
import { getOrCreateDMRoom } from "../data/dm.repository";
import { followUser, unfollowUser } from "../data/follows.repository";
import { createGroupRoom } from "../data/groups.repository";
import { listActiveStoriesByUserIds } from "../data/stories.repository";
import { useFollowedProfiles } from "../hooks/useFollowedProfiles";
import { useUserSearch, type UserSearchItem } from "../hooks/useUserSearch";
import {
  addOpenConversation,
  getOpenConversations,
  markRead,
  markUnread,
  removeOpenConversation,
  shouldKeepConversationRemoved,
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
  const rooms = useChatStore((state) => state.rooms);
  const messagesByRoomId = useChatStore((state) => state.messagesByRoomId);
  const loadRooms = useChatStore((state) => state.loadRooms);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openConversations, setOpenConversations] = useState(getOpenConversations);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
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
    if (!currentUserId) return;

    void loadRooms();

    const refreshRooms = () => {
      void loadRooms();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshRooms();
      }
    };

    window.addEventListener("focus", refreshRooms);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshRooms);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentUserId, loadRooms]);

  useEffect(() => {
    if (!currentUserId) return;
    void loadRooms();
  }, [currentUserId, loadRooms, messagesByRoomId]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    let ws: WebSocket | null = null;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadRooms(true);
      }, 250);
    };

    const connect = async () => {
      const supabase = getSupabaseClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token || !active) return;

      ws = new WebSocket(cloudRealtimeWsUrl(token));
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: { roomId?: string; senderId?: string };
          };
          if (parsed.type === "room_updated") {
            scheduleRefresh();
          }
        } catch {
          // ignore malformed payload
        }
      };
    };

    void connect();
    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      ws?.close();
    };
  }, [currentUserId, loadRooms]);

  useEffect(() => {
    if (!currentUserId || rooms.length === 0) return;

    const parsePeerIdFromDmTitle = (title: string) => {
      if (!title.startsWith("dm:")) return null;
      const [, a, b] = title.split(":");
      if (!a || !b) return null;
      if (a === currentUserId) return b;
      if (b === currentUserId) return a;
      return null;
    };

    const dmEntries = rooms
      .map((room) => {
        const title = room.title ?? "";
        const peerId = parsePeerIdFromDmTitle(title);
        if (!peerId) return null;
        return { roomId: room.roomId, peerId, lastMessageAt: room.lastMessageAt };
      })
      .filter((item): item is { roomId: string; peerId: string; lastMessageAt: string | null } => item !== null);

    if (dmEntries.length === 0) return;

    let active = true;
    const run = async () => {
      const supabase = getSupabaseClient();
      const peerIds = [...new Set(dmEntries.map((item) => item.peerId))];
      const profilesResult = await supabase
        .from("chat_profiles")
        .select("id, username, avatar_url")
        .in("id", peerIds);

      if (!active) return;
      if (profilesResult.error) return;

      const profiles = (profilesResult.data ?? []) as Array<{
        id: string;
        username: string;
        avatar_url: string | null;
      }>;
      const profileById = new Map(profiles.map((profile) => [profile.id, profile] as const));

      let changed = false;
      for (const entry of dmEntries) {
        if (
          shouldKeepConversationRemoved({
            userId: entry.peerId,
            roomId: entry.roomId,
            lastMessageAt: entry.lastMessageAt,
          })
        ) {
          continue;
        }

        const profile = profileById.get(entry.peerId);
        if (!profile) continue;

        const current = getOpenConversations().find((item) => item.userId === entry.peerId);
        const roomMessages = messagesByRoomId[entry.roomId] ?? [];
        const latestMessage = roomMessages.length > 0 ? roomMessages[roomMessages.length - 1] : undefined;
        const nextPreview =
          latestMessage && !latestMessage.deletedAt
            ? latestMessage.body
            : current?.lastMessagePreview || "Toque para abrir a conversa";

        const next = addOpenConversation({
          userId: entry.peerId,
          type: "dm",
          roomId: entry.roomId,
          username: profile.username,
          avatarUrl: profile.avatar_url ?? undefined,
          lastOpenedAt: entry.lastMessageAt || current?.lastOpenedAt || new Date().toISOString(),
          pinned: current?.pinned,
          muted: current?.muted,
          unreadCount: current?.unreadCount,
          lastMessagePreview: nextPreview,
        });

        if (!current || current.roomId !== entry.roomId || current.lastMessagePreview !== nextPreview) {
          changed = true;
          setOpenConversations(next);
        }
      }

      if (changed) {
        setOpenConversations(getOpenConversations());
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [currentUserId, messagesByRoomId, rooms]);
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
  const contextIsGroup = contextConversation?.type === "group";
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
          roomId: conversation.roomId,
          username: conversation.username,
          avatarUrl: conversation.avatarUrl,
          lastMessage: conversation.lastMessagePreview || "Toque para abrir a conversa",
        })),
    [openConversations],
  );

  const isSearchOpen = searchQuery.trim().length > 0;

  const handleSelectUser = async (user: UserSearchItem) => {
    if (!currentUserId) return;
    const dm = await getOrCreateDMRoom({
      currentUserId,
      otherUserId: user.id,
    });
    const conversation = {
      userId: user.id,
      type: "dm" as const,
      roomId: dm.roomId,
      username: user.username,
      avatarUrl: user.avatar_url ?? undefined,
      lastOpenedAt: new Date().toISOString(),
    };

    addOpenConversation(conversation);
    setOpenConversations(getOpenConversations());
    setSearchQuery("");
    setActiveSearchIndex(0);
    navigate(`/chat/conversation/${dm.roomId}`, {
      state: {
        type: "dm",
        peerId: user.id,
        username: user.username,
        avatarUrl: user.avatar_url ?? undefined,
      },
    });
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
    const next = removeOpenConversation(contextUserId, contextConversation?.roomId);
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
      ...(contextIsGroup
        ? []
        : [
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
          ]),
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
      contextIsGroup,
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
          currentUserId={currentUserId}
          onOpenUserId={(userId) => {
            const open = async () => {
              if (!currentUserId) return;
              const next = markRead(userId);
              setOpenConversations(next);
              const target = openConversations.find((item) => item.userId === userId);
              if (target?.type === "group" && target.roomId) {
                navigate(`/chat/conversation/${target.roomId}`, {
                  state: {
                    type: "group",
                    groupName: target.username,
                    avatarUrl: target.avatarUrl,
                  },
                });
                return;
              }
              if (target?.type === "dm" && target.roomId) {
                navigate(`/chat/conversation/${target.roomId}`, {
                  state: {
                    type: "dm",
                    peerId: userId,
                    username: target?.username ?? "Conversa",
                    avatarUrl: target?.avatarUrl,
                  },
                });
                return;
              }
              const dm = await getOrCreateDMRoom({
                currentUserId,
                otherUserId: userId,
              });
              navigate(`/chat/conversation/${dm.roomId}`, {
                state: {
                  type: "dm",
                  peerId: userId,
                  username: target?.username ?? "Conversa",
                  avatarUrl: target?.avatarUrl,
                },
              });
            };
            void open();
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
        onCreateGroup={() => setCreateGroupOpen(true)}
        onCreateServer={() => navigate("/chat/server/create")}
      />
      <CreateGroupOverlay
        open={createGroupOpen}
        currentUserId={currentUserId}
        onClose={() => setCreateGroupOpen(false)}
        onCreateNow={async (payload) => {
          if (!currentUserId) return;
          const created = await createGroupRoom({
            ownerId: currentUserId,
            name: payload.name,
            description: payload.description,
            memberIds: payload.memberIds,
            imageFile: payload.imageFile,
          });
          if (!created.roomId) return;
          addOpenConversation({
            userId: `group:${created.roomId}`,
            type: "group",
            roomId: created.roomId,
            username: payload.name,
            lastOpenedAt: new Date().toISOString(),
          });
          setOpenConversations(getOpenConversations());
          setCreateGroupOpen(false);
          navigate(`/chat/conversation/${created.roomId}`, {
            state: {
              type: "group",
              groupName: payload.name,
            },
          });
        }}
        onSchedule={async (payload) => {
          if (!currentUserId) return;
          await createGroupRoom({
            ownerId: currentUserId,
            name: payload.name,
            description: payload.description,
            memberIds: payload.memberIds,
            imageFile: payload.imageFile,
            scheduleAt: payload.scheduleAt || new Date().toISOString(),
          });
          setCreateGroupOpen(false);
        }}
      />
    </div>
  );
}
