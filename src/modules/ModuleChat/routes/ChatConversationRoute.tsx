import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { useChatStore } from "../chatStore";
import { getGroupByRoomId, type GroupView } from "../data/groups.repository";
import {
  ConversationFooter,
  ConversationHeader,
  ConversationTopUserCard,
  MessageList,
} from "./conversation/components";
import { useAutoScroll } from "./conversation/hooks/useAutoScroll";
import type { Message } from "./conversation/types/message";

export function ChatConversationRoute() {
  const { roomId } = useParams();
  const location = useLocation();
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const openRoom = useChatStore((state) => state.openRoom);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const activeRoomId = useChatStore((state) => state.activeRoomId);
  const rooms = useChatStore((state) => state.rooms);
  const messagesByRoomId = useChatStore((state) => state.messagesByRoomId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [groupData, setGroupData] = useState<GroupView | null>(null);
  const rawMessages = roomId ? (messagesByRoomId[roomId] ?? []) : [];
  const routeState = location.state as
    | {
        type?: "dm" | "group";
        username?: string;
        avatarUrl?: string;
        groupName?: string;
      }
    | undefined;

  const messages: Message[] = useMemo(
    () =>
      rawMessages.map((item) => ({
        id: item.id,
        conversationUserId: roomId ?? "",
        senderId: item.userId === currentUserId ? "me" : item.userId,
        text: item.deletedAt ? "[mensagem removida]" : item.body,
        createdAt: item.createdAt,
        status: "sent",
      })),
    [currentUserId, rawMessages, roomId],
  );

  useAutoScroll(scrollRef, messages);

  useEffect(() => {
    if (!roomId) return;
    if (activeRoomId === roomId) return;
    void openRoom(roomId);
  }, [activeRoomId, openRoom, roomId]);

  const room = useMemo(() => rooms.find((item) => item.roomId === roomId) ?? null, [roomId, rooms]);
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
  const headerUsername = useMemo(() => {
    if (routeState?.type === "group") {
      return routeState.groupName || groupData?.name || room?.title || "Grupo";
    }
    if (routeState?.username) return routeState.username;
    if (groupData?.name) return groupData.name;
    return room?.title || "Conversa";
  }, [groupData?.name, room?.title, routeState?.groupName, routeState?.type, routeState?.username]);
  const headerSubtitle = useMemo(
    () => (routeState?.type === "group" || groupData ? "grupo" : "online"),
    [groupData, routeState?.type],
  );

  return (
    <section className="chatConversationRoute" data-no-drag="true">
      <div className="chatConversationHeaderWrap" data-no-drag="true">
        <ConversationHeader storyCount={5} activeStoryIndex={0} />
        <div className="chatConversationTopCard" data-no-drag="true">
          <ConversationTopUserCard
            username={headerUsername}
            subtitle={headerSubtitle}
            avatarUrl={routeState?.avatarUrl || groupData?.image_url || undefined}
          />
        </div>
      </div>

      <div className="chatConversationMessagesScroll" ref={scrollRef} data-no-drag="true">
        <MessageList messages={messages} />
      </div>

      <div className="chatConversationFooterWrap" data-no-drag="true">
        <ConversationFooter onSend={(text) => void sendMessage(text)} />
      </div>
    </section>
  );
}
