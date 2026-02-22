import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FiCopy, FiCornerUpLeft, FiEdit2, FiMapPin, FiPlus, FiStar, FiTrash2 } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";
import { getSupabaseClient } from "../../../core/services/supabase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { useChatStore } from "../chatStore";
import { getGroupByRoomId, type GroupView } from "../data/groups.repository";
import { ensureDMRoomLink } from "../data/dm.repository";
import {
  deleteForAll,
  deleteForMe,
  editMessage,
  getFavorites,
  getPinned,
  listMessageReactions,
  listMessages,
  sendMediaMessage,
  sendTextMessage,
  toggleReaction,
  toggleFavorite,
  togglePin,
  type ChatMessageRecord,
} from "../data/messages.repository";
import { listActiveStoriesByUserIds } from "../data/stories.repository";
import {
  ConversationFooter,
  ConversationHeader,
  ConversationTopUserCard,
  MessageList,
} from "./conversation/components";
import { useAutoScroll } from "./conversation/hooks/useAutoScroll";
import type { Message, MessageReaction } from "./conversation/types/message";

const PAGE_SIZE = 30;

function mergeById(current: Message[], incoming: Message[]) {
  const map = new Map<string, Message>();
  for (const item of current) map.set(item.id, item);
  for (const item of incoming) {
    const existing = map.get(item.id);
    map.set(item.id, {
      ...existing,
      ...item,
      reactions: item.reactions ?? existing?.reactions ?? [],
    });
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function ChatConversationRoute() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const openRoom = useChatStore((state) => state.openRoom);
  const activeRoomId = useChatStore((state) => state.activeRoomId);
  const rooms = useChatStore((state) => state.rooms);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [groupData, setGroupData] = useState<GroupView | null>(null);
  const [hasAuthorStory, setHasAuthorStory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [replyTargets, setReplyTargets] = useState<Array<{ id: string; text: string; author: string }>>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);
  const [contextOutgoing, setContextOutgoing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const routeState = location.state as
    | {
        type?: "dm" | "group";
        peerId?: string;
        username?: string;
        avatarUrl?: string;
        groupName?: string;
      }
    | undefined;

  useAutoScroll(scrollRef, messages);

  useEffect(() => {
    if (!roomId) return;
    if (activeRoomId === roomId) return;
    void openRoom(roomId);
  }, [activeRoomId, openRoom, roomId]);

  const room = useMemo(() => rooms.find((item) => item.roomId === roomId) ?? null, [roomId, rooms]);

  const headerUsername = useMemo(() => {
    if (routeState?.type === "group") {
      return routeState.groupName || groupData?.name || room?.title || "Grupo";
    }
    if (routeState?.username) return routeState.username;
    if (groupData?.name) return groupData.name;
    return room?.title || "Conversa";
  }, [groupData?.name, room?.title, routeState?.groupName, routeState?.type, routeState?.username]);

  const mapRecordToMessage = useCallback(
    async (row: ChatMessageRecord): Promise<Message> => {
      let mediaUrl: string | null = null;
      if (row.media_path) {
        try {
          const supabase = getSupabaseClient();
          const signed = await supabase.storage.from("chat-media").createSignedUrl(row.media_path, 60 * 5);
          mediaUrl = signed.data?.signedUrl ?? null;
        } catch {
          mediaUrl = null;
        }
      }

      return {
        id: row.id,
        roomId: row.room_id,
        conversationUserId: roomId ?? "",
        senderId: row.sender_id === currentUserId ? "me" : row.sender_id,
        rawSenderId: row.sender_id,
        type: row.type,
        text: row.body_text ?? "",
        mediaPath: row.media_path,
        mediaUrl,
        mediaMime: row.media_mime,
        mediaSize: row.media_size,
        audioDurationMs: row.audio_duration_ms,
        replyToIds: row.reply_to_ids,
        editedAt: row.edited_at,
        deletedForAll: row.deleted_for_all,
        createdAt: row.created_at,
        status: "sent",
        reactions: [],
      };
    },
    [currentUserId, roomId],
  );

  const refreshReactionsForMessages = useCallback(async (messageIds: string[]) => {
    const uniqueIds = [...new Set(messageIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    const grouped = await listMessageReactions(uniqueIds);
    setMessages((prev) =>
      prev.map((item) => {
        const reactions = (grouped[item.id] ?? []).map(
          (reaction): MessageReaction => ({
            emoji: reaction.emoji,
            count: reaction.count,
            reactedByMe: reaction.reactedByMe,
            users: reaction.users.map((user) => ({
              id: user.id,
              username: user.username,
              avatarUrl: user.avatar_url,
            })),
          }),
        );
        return { ...item, reactions };
      }),
    );
  }, []);

  const loadLatest = useCallback(async () => {
    if (!roomId) return;
    setLoadingMessages(true);
    try {
      const dmPeerId = routeState?.peerId;
      const isDm = !groupData && Boolean(dmPeerId);
      if (isDm && currentUserId && dmPeerId) {
        await ensureDMRoomLink({
          roomId,
          currentUserId,
          otherUserId: dmPeerId,
        });
      }
      const rows = await listMessages({ roomId, limit: PAGE_SIZE });
      const mapped = await Promise.all(rows.map(mapRecordToMessage));
      setMessages(mapped);
      setHasMore(rows.length >= PAGE_SIZE);
      await refreshReactionsForMessages(mapped.map((item) => item.id));
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUserId, groupData, mapRecordToMessage, refreshReactionsForMessages, roomId, routeState?.peerId]);

  const loadMore = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const rows = await listMessages({ roomId, limit: PAGE_SIZE, before: oldest.createdAt });
      const mapped = await Promise.all(rows.map(mapRecordToMessage));
      const merged = mergeById(mapped, messages);
      setMessages(merged);
      setHasMore(rows.length >= PAGE_SIZE);
      await refreshReactionsForMessages(merged.map((item) => item.id));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, mapRecordToMessage, messages, refreshReactionsForMessages, roomId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`chat_messages_room_${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          void (async () => {
            const mapped = await mapRecordToMessage(payload.new as ChatMessageRecord);
            setMessages((prev) => mergeById(prev, [mapped]));
            await refreshReactionsForMessages([mapped.id]);
          })();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          void (async () => {
            const mapped = await mapRecordToMessage(payload.new as ChatMessageRecord);
            setMessages((prev) => mergeById(prev, [mapped]));
            await refreshReactionsForMessages([mapped.id]);
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mapRecordToMessage, refreshReactionsForMessages, roomId]);

  useEffect(() => {
    if (!roomId) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop <= 32) {
        void loadMore();
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore, roomId]);

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const run = async () => {
      try {
        const [favs, pins] = await Promise.all([getFavorites(roomId), getPinned(roomId)]);
        if (!active) return;
        setFavoriteIds(new Set(favs.map((item) => item.message.id)));
        setPinnedIds(new Set(pins.map((item) => item.message.id)));
      } catch {
        if (!active) return;
        setFavoriteIds(new Set());
        setPinnedIds(new Set());
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setGroupData(null);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        const group = await getGroupByRoomId(roomId);
        if (!active) return;
        setGroupData(group);
      } catch {
        if (!active) return;
        setGroupData(null);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [roomId]);

  useEffect(() => {
    const isGroupConversation = routeState?.type === "group" || Boolean(groupData);
    const authorUserId = routeState?.peerId;

    if (isGroupConversation || !authorUserId) {
      setHasAuthorStory(false);
      return;
    }

    let active = true;
    const run = async () => {
      try {
        const stories = await listActiveStoriesByUserIds([authorUserId]);
        if (!active) return;
        setHasAuthorStory(stories.length > 0);
      } catch {
        if (!active) return;
        setHasAuthorStory(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [groupData, routeState?.peerId, routeState?.type]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!footerWrapRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!footerWrapRef.current.contains(target)) {
        setEmojiOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [emojiOpen]);

  const headerSubtitle = useMemo(
    () => (routeState?.type === "group" || groupData ? "grupo" : "online"),
    [groupData, routeState?.type],
  );

  const contextMessage = useMemo(
    () => (contextMessageId ? messages.find((item) => item.id === contextMessageId) ?? null : null),
    [contextMessageId, messages],
  );

  const closeContextMenu = () => {
    setContextOpen(false);
    setContextMessageId(null);
  };

  const handleDeleteForMe = async () => {
    if (!contextMessage?.roomId) return;
    await deleteForMe({ id: contextMessage.id, room_id: contextMessage.roomId });
    setMessages((prev) => prev.filter((item) => item.id !== contextMessage.id));
    closeContextMenu();
  };

  const handleDeleteForAll = async () => {
    if (!contextMessageId || !contextOutgoing) return;
    await deleteForAll(contextMessageId);
    setMessages((prev) =>
      prev.map((item) =>
        item.id === contextMessageId
          ? {
              ...item,
              text: "[mensagem removida]",
              mediaPath: null,
              mediaUrl: null,
              mediaMime: null,
              mediaSize: null,
              audioDurationMs: null,
              deletedForAll: true,
            }
          : item,
      ),
    );
    closeContextMenu();
  };

  const handleTogglePinned = async () => {
    if (!roomId || !contextMessageId) return;
    const next = await togglePin(roomId, contextMessageId);
    setPinnedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(contextMessageId);
      else copy.delete(contextMessageId);
      return copy;
    });
    closeContextMenu();
  };

  const handleToggleFavorite = async () => {
    if (!contextMessageId) return;
    const next = await toggleFavorite(contextMessageId);
    setFavoriteIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(contextMessageId);
      else copy.delete(contextMessageId);
      return copy;
    });
    closeContextMenu();
  };

  const handleReplyMessage = () => {
    if (!contextMessage) return;
    setReplyTargets((prev) => {
      if (prev.some((item) => item.id === contextMessage.id)) return prev;
      return [
        ...prev,
        {
          id: contextMessage.id,
          text: contextMessage.text,
          author: contextMessage.senderId === "me" ? "Voce" : headerUsername,
        },
      ];
    });
    closeContextMenu();
  };

  const handleEditMessage = () => {
    if (!contextMessage || !contextOutgoing) return;
    setEditingMessageId(contextMessage.id);
    setComposerText(contextMessage.text);
    setReplyTargets([]);
    closeContextMenu();
  };

  const handleCopyMessage = async () => {
    if (!contextMessage) return;
    await navigator.clipboard.writeText(contextMessage.text);
    closeContextMenu();
  };

  const handleSend = async (text: string) => {
    if (!roomId) return;
    const dmPeerId = routeState?.peerId;
    const isDm = !groupData && Boolean(dmPeerId);
    if (isDm && currentUserId && dmPeerId) {
      await ensureDMRoomLink({
        roomId,
        currentUserId,
        otherUserId: dmPeerId,
      });
    }
    if (editingMessageId) {
      const updated = await editMessage(editingMessageId, text);
      const mapped = await mapRecordToMessage(updated);
      setMessages((prev) => mergeById(prev, [mapped]));
      await refreshReactionsForMessages([mapped.id]);
      setEditingMessageId(null);
      setComposerText("");
      return;
    }

    const replyPrefix =
      replyTargets.length > 0 ? `${replyTargets.map((item) => `> ${item.author}: ${item.text}`).join("\n")}\n` : "";
    const saved = await sendTextMessage({
      roomId,
      text: `${replyPrefix}${text}`,
      replyToIds: replyTargets.map((item) => item.id),
      receiverId: routeState?.peerId ?? null,
    });
    const mapped = await mapRecordToMessage(saved);
    setMessages((prev) => mergeById(prev, [mapped]));
    await refreshReactionsForMessages([mapped.id]);
    setComposerText("");
    setReplyTargets([]);
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleAttachFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!roomId) return;
    const dmPeerId = routeState?.peerId;
    const isDm = !groupData && Boolean(dmPeerId);
    if (isDm && currentUserId && dmPeerId) {
      await ensureDMRoomLink({
        roomId,
        currentUserId,
        otherUserId: dmPeerId,
      });
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const saved = await sendMediaMessage({
      roomId,
      file,
      replyToIds: replyTargets.map((item) => item.id),
      receiverId: routeState?.peerId ?? null,
    });
    const mapped = await mapRecordToMessage(saved);
    setMessages((prev) => mergeById(prev, [mapped]));
    await refreshReactionsForMessages([mapped.id]);
    setReplyTargets([]);
  };

  const handleToggleRecord = async () => {
    if (!roomId) return;
    const dmPeerId = routeState?.peerId;
    const isDm = !groupData && Boolean(dmPeerId);
    if (isDm && currentUserId && dmPeerId) {
      await ensureDMRoomLink({
        roomId,
        currentUserId,
        otherUserId: dmPeerId,
      });
    }
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunks.push(evt.data);
      };

      recorder.onstop = async () => {
        const startedAt = recordingStartedAtRef.current ?? Date.now();
        const durationMs = Math.max(1, Date.now() - startedAt);
        stream.getTracks().forEach((track) => track.stop());
        recordingStartedAtRef.current = null;
        mediaRecorderRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: recorder.mimeType || "audio/webm",
        });
        const saved = await sendMediaMessage({
          roomId,
          file,
          type: "audio",
          durationMs,
          replyToIds: replyTargets.map((item) => item.id),
          receiverId: routeState?.peerId ?? null,
        });
        const mapped = await mapRecordToMessage(saved);
        setMessages((prev) => mergeById(prev, [mapped]));
        await refreshReactionsForMessages([mapped.id]);
        setReplyTargets([]);
      };

      recorder.start();
    } catch {
      setIsRecording(false);
    }
  };

  const emojiOptions = ["😀", "😂", "😍", "😎", "🔥", "👏", "😢", "😡", "🙏", "👍", "❤️", "🎉"];

  const reactionOptions = ["👍", "❤️", "😂", "🔥", "😮", "👏"];

  const handleToggleReaction = useCallback(
    async (message: Message, emoji: string) => {
      if (!message.roomId) return;
      await toggleReaction({ messageId: message.id, roomId: message.roomId, emoji });
      await refreshReactionsForMessages([message.id]);
    },
    [refreshReactionsForMessages],
  );

  const contextItems = useMemo<ContextMenuBaseItem[]>(
    () => [
      {
        id: "reaction-row",
        kind: "custom",
        content: (
          <div className="chat-context-reaction-row" data-no-drag="true">
            {reactionOptions.map((emoji) => {
              const isActive = Boolean(
                contextMessage?.reactions?.some((reaction) => reaction.emoji === emoji && reaction.reactedByMe),
              );
              return (
              <button
                key={`context-reaction-${emoji}`}
                type="button"
                className={`chat-context-reaction-btn${isActive ? " active" : ""}`}
                onClick={() => {
                  if (!contextMessage) return;
                  void handleToggleReaction(contextMessage, emoji);
                  closeContextMenu();
                }}
              >
                {emoji}
              </button>
              );
            })}
            <button
              type="button"
              className="chat-context-reaction-btn chat-context-reaction-plus"
              onClick={() => {
                setEmojiOpen(true);
                closeContextMenu();
              }}
            >
              <FiPlus size={14} />
            </button>
          </div>
        ),
      },
      { id: "reactions-divider", kind: "divider" },
      {
        id: "delete-me",
        label: "Apagar para mim",
        icon: <FiTrash2 size={16} />,
        onClick: () => {
          void handleDeleteForMe();
        },
      },
      {
        id: "delete-all",
        label: "Apagar para todos",
        icon: <FiTrash2 size={16} />,
        disabled: !contextOutgoing,
        onClick: () => {
          void handleDeleteForAll();
        },
      },
      {
        id: "pin",
        label: roomId && contextMessageId && pinnedIds.has(contextMessageId) ? "Desafixar mensagem" : "Fixar mensagem",
        icon: <FiMapPin size={16} />,
        onClick: () => {
          void handleTogglePinned();
        },
      },
      {
        id: "favorite",
        label: contextMessageId && favoriteIds.has(contextMessageId) ? "Desfavoritar mensagem" : "Favoritar mensagem",
        icon: <FiStar size={16} />,
        onClick: () => {
          void handleToggleFavorite();
        },
      },
      {
        id: "open-favorites",
        label: "Abrir Favoritos",
        icon: <FiStar size={16} />,
        onClick: () => {
          navigate("/chat/favs");
          closeContextMenu();
        },
      },
      {
        id: "reply",
        label: "Responder mensagem",
        icon: <FiCornerUpLeft size={16} />,
        onClick: handleReplyMessage,
      },
      {
        id: "edit",
        label: "Editar mensagem",
        icon: <FiEdit2 size={16} />,
        disabled: !contextOutgoing,
        onClick: handleEditMessage,
      },
      {
        id: "copy",
        label: "Copiar mensagem",
        icon: <FiCopy size={16} />,
        onClick: () => {
          void handleCopyMessage();
        },
      },
    ],
    [contextMessage, contextMessageId, contextOutgoing, favoriteIds, navigate, pinnedIds, reactionOptions, roomId],
  );

  return (
    <section className="chatConversationRoute" data-no-drag="true">
      <div className="chatConversationHeaderWrap" data-no-drag="true">
        {hasAuthorStory ? <ConversationHeader storyCount={1} activeStoryIndex={0} /> : null}
        <div className="chatConversationTopCard" data-no-drag="true">
          <ConversationTopUserCard
            username={headerUsername}
            subtitle={headerSubtitle}
            avatarUrl={routeState?.avatarUrl || groupData?.image_url || undefined}
          />
        </div>
      </div>

      <div className="chatConversationMessagesScroll" ref={scrollRef} data-no-drag="true">
        {loadingMessages ? (
          <div className="chat-route-placeholder" data-no-drag="true">
            Carregando mensagens...
          </div>
        ) : null}
        <MessageList
          messages={messages}
          onMessageContextMenu={(event, message, isOutgoing) => {
            event.preventDefault();
            setContextX(event.clientX);
            setContextY(event.clientY);
            setContextMessageId(message.id);
            setContextOutgoing(isOutgoing);
            setContextOpen(true);
          }}
        />
        {loadingMore ? <div className="chat-route-placeholder">Carregando mais...</div> : null}
      </div>

      <div className="chatConversationFooterWrap" data-no-drag="true" ref={footerWrapRef}>
        {emojiOpen ? (
          <div className="chatEmojiOverlay" data-no-drag="true">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="chatEmojiOverlayItem"
                onClick={() => {
                  setComposerText((prev) => `${prev}${emoji}`);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <ConversationFooter
          value={composerText}
          onChangeMessage={setComposerText}
          replyItems={replyTargets}
          onRemoveReplyItem={(id) => {
            setReplyTargets((prev) => prev.filter((item) => item.id !== id));
          }}
          onSend={(text) => {
            void handleSend(text);
          }}
          onAttach={handleAttach}
          onRecord={() => {
            void handleToggleRecord();
          }}
          onOpenEmoji={() => setEmojiOpen((prev) => !prev)}
          isRecording={isRecording}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="chatHiddenFileInput"
          onChange={(event) => {
            void handleAttachFileChange(event);
          }}
        />
      </div>
      <ContextMenuBase
        open={contextOpen}
        anchorPoint={{ x: contextX, y: contextY }}
        onClose={closeContextMenu}
        items={contextItems}
      />
    </section>
  );
}
