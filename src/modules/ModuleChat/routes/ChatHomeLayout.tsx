import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";
import { cloudRealtimeWsUrl } from "../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../core/services/supabase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { useWorkspaceSearchStore } from "../../../core/workspace/searchStore";
import {
  FiBell,
  FiBellOff,
  FiMail,
  FiStar,
  FiTrash2,
  FiUser,
  RiUserFollowLine,
  RiUserUnfollowLine,
} from "../../../shared/ui/icons";
import { useChatStore } from "../chatStore";
import { CreateGroupOverlay, FloatingCreateMenu, ModuleHeader } from "../components";
import { getOrCreateDMRoom } from "../data/dm.repository";
import { followUser, unfollowUser } from "../data/follows.repository";
import { createGroupRoom } from "../data/groups.repository";
import { listActiveStoriesByUserIds } from "../data/stories.repository";
import { searchChatUsers, type ChatUser } from "../data/users.repository";
import { useFollowedProfiles } from "../hooks/useFollowedProfiles";
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
import { ChatHomeRoute, type ConversationListItem } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useSessionStore((state) => state.logout);
  const currentUser = useSessionStore((state) => state.user);
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const rooms = useChatStore((state) => state.rooms);
  const messagesByRoomId = useChatStore((state) => state.messagesByRoomId);
  const loadRooms = useChatStore((state) => state.loadRooms);
  const [openConversations, setOpenConversations] = useState(getOpenConversations);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextItem, setContextItem] = useState<ConversationListItem | null>(null);
  const [searchedUsers, setSearchedUsers] = useState<ChatUser[]>([]);
  const [loadingSearchedUsers, setLoadingSearchedUsers] = useState(false);
  const [searchUsersError, setSearchUsersError] = useState<string | null>(null);
  const { profiles: followedProfiles, refresh: refreshFollowedProfiles } = useFollowedProfiles();
  const [storyUserIds, setStoryUserIds] = useState<Set<string>>(new Set());
  const followedIds = useMemo(() => new Set(followedProfiles.map((item) => item.id)), [followedProfiles]);
  const chatSearchQuery = useWorkspaceSearchStore((state) => state.queries.chat ?? "");
  const normalizedChatSearchQuery = useMemo(() => chatSearchQuery.trim(), [chatSearchQuery]);
  const normalizedChatApiQuery = useMemo(
    () => normalizedChatSearchQuery.replace(/^@+/, ""),
    [normalizedChatSearchQuery],
  );

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
    if (!normalizedChatApiQuery) {
      setSearchedUsers([]);
      setSearchUsersError(null);
      setLoadingSearchedUsers(false);
      return;
    }

    let active = true;
    const timerId = window.setTimeout(() => {
      const run = async () => {
        setLoadingSearchedUsers(true);
        setSearchUsersError(null);
        try {
          const users = await searchChatUsers(normalizedChatApiQuery, 30);
          if (!active) return;
          setSearchedUsers(users);
        } catch (error) {
          if (!active) return;
          setSearchedUsers([]);
          setSearchUsersError(error instanceof Error ? error.message : "Falha ao buscar usuarios.");
        } finally {
          if (active) {
            setLoadingSearchedUsers(false);
          }
        }
      };
      void run();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [normalizedChatApiQuery]);

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

  const contextUserId = contextItem?.userId ?? null;
  const contextConversation = useMemo(
    () =>
      contextUserId === null
        ? null
        : (openConversations.find((conversation) => conversation.userId === contextUserId) ?? null),
    [contextUserId, openConversations],
  );
  const contextIsGroup =
    contextItem?.conversationType === "group" || contextConversation?.type === "group";
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

  const sortedConversations = useMemo(
    () =>
      [...openConversations].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
      }),
    [openConversations],
  );

  const chatItems = useMemo(() => {
    const conversationItems: ConversationListItem[] = sortedConversations.map((conversation) => ({
      userId: conversation.userId,
      roomId: conversation.roomId,
      conversationType: conversation.type === "group" ? "group" : "dm",
      username: conversation.username,
      avatarUrl: conversation.avatarUrl,
      lastMessage: conversation.lastMessagePreview || "Toque para abrir a conversa",
    }));

    if (!normalizedChatApiQuery) {
      return conversationItems;
    }

    const query = normalizedChatApiQuery.toLowerCase();
    const filteredConversationItems = conversationItems.filter((conversation) => {
      const username = conversation.username.toLowerCase();
      const lastMessage = conversation.lastMessage.toLowerCase();
      return username.includes(query) || lastMessage.includes(query);
    });

    if (searchUsersError) {
      return filteredConversationItems;
    }

    const mergedByUserId = new Map(filteredConversationItems.map((item) => [item.userId, item] as const));
    const conversationByUserId = new Map(conversationItems.map((item) => [item.userId, item] as const));

    for (const user of searchedUsers) {
      if (user.id === currentUserId) continue;
      const existing = conversationByUserId.get(user.id);
      const mapped: ConversationListItem = {
        userId: user.id,
        roomId: existing?.roomId,
        conversationType: "dm",
        username: user.username,
        avatarUrl: user.avatar_url ?? existing?.avatarUrl,
        lastMessage: existing?.lastMessage || "Toque para iniciar conversa",
      };
      const current = mergedByUserId.get(user.id);
      mergedByUserId.set(user.id, {
        ...mapped,
        ...current,
        username: mapped.username,
        avatarUrl: mapped.avatarUrl,
        roomId: current?.roomId ?? mapped.roomId,
        conversationType: current?.conversationType ?? mapped.conversationType,
        lastMessage: current?.lastMessage || mapped.lastMessage,
      });
    }

    return [...mergedByUserId.values()];
  }, [currentUserId, normalizedChatApiQuery, searchUsersError, searchedUsers, sortedConversations]);

  const closeContextMenu = () => {
    setContextOpen(false);
    setContextItem(null);
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
    if (!contextUserId || contextIsGroup || contextUserId === currentUserId) return;
    if (followedIds.has(contextUserId)) {
      await handleUnfollowUser(contextUserId);
    } else {
      await handleFollowUser(contextUserId);
    }
    closeContextMenu();
  };

  const handleOpenProfileFromContext = () => {
    if (!contextUserId || contextIsGroup) return;
    closeContextMenu();
    navigate(`/chat/profile/${contextUserId}`);
  };
  const contextItems = useMemo<ContextMenuBaseItem[]>(() => {
    const canOpenProfile = Boolean(contextUserId) && !contextIsGroup;
    const canFollow = canOpenProfile && contextUserId !== currentUserId;
    const items: ContextMenuBaseItem[] = [];

    if (canOpenProfile) {
      items.push({
        id: "open-profile",
        label: "Abrir perfil",
        icon: <FiUser size={16} />,
        onClick: handleOpenProfileFromContext,
      });
    }

    if (canFollow) {
      items.push({
        id: "follow",
        label: contextUserId && followedIds.has(contextUserId) ? "Deixar de seguir" : "Seguir",
        icon:
          contextUserId && followedIds.has(contextUserId) ? (
            <RiUserUnfollowLine size={16} />
          ) : (
            <RiUserFollowLine size={16} />
          ),
        onClick: handleFollowFromContext,
      });
    }

    if (contextConversation) {
      if (items.length > 0) {
        items.push({ id: "profile-divider", label: "", kind: "divider" });
      }

      items.push(
        {
          id: "pin",
          label: contextConversation.pinned ? "Desafixar conversa" : "Fixar conversa",
          icon: <FiStar size={16} />,
          onClick: handleTogglePinned,
        },
        {
          id: "mute",
          label: contextConversation.muted ? "Ativar notificacoes" : "Silenciar",
          icon: contextConversation.muted ? <FiBellOff size={16} /> : <FiBell size={16} />,
          onClick: handleToggleMuted,
        },
        {
          id: "unread",
          label: "Marcar como nao lida",
          icon: <FiMail size={16} />,
          onClick: handleMarkUnread,
        },
        { id: "conversation-divider", label: "", kind: "divider" },
        {
          id: "remove",
          label: "Remover conversa",
          icon: <FiTrash2 size={16} />,
          onClick: handleRemoveConversation,
        },
      );
    }

    return items;
  }, [
    contextConversation,
    contextIsGroup,
    contextUserId,
    currentUserId,
    followedIds,
    handleFollowFromContext,
    handleMarkUnread,
    handleOpenProfileFromContext,
    handleRemoveConversation,
    handleToggleMuted,
    handleTogglePinned,
  ]);
  const showSearchLoading = Boolean(normalizedChatApiQuery) && loadingSearchedUsers && chatItems.length === 0;

  return (
    <div className="chat-home-layout" data-no-drag="true">
      <ModuleHeader
        stories={stories}
        onOpenStory={(storyId) => navigate(`/chat/story/${storyId}`)}
      />
      <div className="chat-home-layout-content" data-no-drag="true">
        {showSearchLoading ? (
          <div className="chat-route-placeholder">Buscando usuarios...</div>
        ) : normalizedChatApiQuery && chatItems.length === 0 ? (
          <div className="chat-route-placeholder">
            {searchUsersError ? "Falha ao buscar usuarios." : "Nenhum usuario encontrado."}
          </div>
        ) : (
          <ChatHomeRoute
            items={chatItems}
            currentUserId={currentUserId}
            onOpenItem={(item) => {
              const open = async () => {
                if (!currentUserId) return;
                const next = markRead(item.userId);
                setOpenConversations(next);

                if (item.conversationType === "group" && item.roomId) {
                  navigate(`/chat/conversation/${item.roomId}`, {
                    state: {
                      type: "group",
                      groupName: item.username,
                      avatarUrl: item.avatarUrl,
                    },
                  });
                  return;
                }

                if (item.roomId) {
                  navigate(`/chat/conversation/${item.roomId}`, {
                    state: {
                      type: "dm",
                      peerId: item.userId,
                      username: item.username || "Conversa",
                      avatarUrl: item.avatarUrl,
                    },
                  });
                  return;
                }

                const dm = await getOrCreateDMRoom({
                  currentUserId,
                  otherUserId: item.userId,
                });
                const updated = addOpenConversation({
                  userId: item.userId,
                  type: "dm",
                  roomId: dm.roomId,
                  username: item.username,
                  avatarUrl: item.avatarUrl,
                  lastOpenedAt: new Date().toISOString(),
                  lastMessagePreview: item.lastMessage,
                });
                setOpenConversations(updated);
                navigate(`/chat/conversation/${dm.roomId}`, {
                  state: {
                    type: "dm",
                    peerId: item.userId,
                    username: item.username || "Conversa",
                    avatarUrl: item.avatarUrl,
                  },
                });
              };
              void open();
            }}
            onOpenContextMenu={({ x, y, item }) => {
              setContextX(x);
              setContextY(y);
              setContextItem(item);
              setContextOpen(true);
            }}
          />
        )}
      </div>
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
        onOpenFavorites={() => navigate("/chat/favs")}
        onMyAccount={() => navigate("/chat/account")}
        onChatSettings={() => navigate("/chat/settings")}
        onLogout={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
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
