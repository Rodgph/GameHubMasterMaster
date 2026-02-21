import { useEffect, useMemo, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useSessionStore } from "../../core/stores/sessionStore";
import { useChatStore } from "./chatStore";
import { ChatModuleLayout } from "./ChatModuleLayout";
import {
  ChatAccountRoute,
  ChatConversationRoute,
  ChatHomeLayout,
  ChatSettingsRoute,
} from "./routes";
import "./chat.css";

export function ChatModule() {
  const location = useLocation();
  const user = useSessionStore((state) => state.user);
  const rooms = useChatStore((state) => state.rooms);
  const activeRoomId = useChatStore((state) => state.activeRoomId);
  const messagesByRoomId = useChatStore((state) => state.messagesByRoomId);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const loadingRooms = useChatStore((state) => state.loadingRooms);
  const loadingMessages = useChatStore((state) => state.loadingMessages);
  const error = useChatStore((state) => state.error);
  const loadRooms = useChatStore((state) => state.loadRooms);
  const createRoom = useChatStore((state) => state.createRoom);
  const openRoom = useChatStore((state) => state.openRoom);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);

  const [roomTitle, setRoomTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId || rooms.length === 0) return;
    void openRoom(rooms[0].roomId);
  }, [activeRoomId, openRoom, rooms]);

  const messages = useMemo(
    () => (activeRoomId ? (messagesByRoomId[activeRoomId] ?? []) : []),
    [activeRoomId, messagesByRoomId],
  );

  const activeRoomTitle =
    rooms.find((room) => room.roomId === activeRoomId)?.title ?? "Selecione uma sala";

  const handleCreateRoom = async () => {
    await createRoom(roomTitle);
    setRoomTitle("");
  };

  const handleSend = async () => {
    await sendMessage(draft);
    setDraft("");
  };

  void user;
  void wsStatus;
  void loadingRooms;
  void loadingMessages;
  void error;
  void editMessage;
  void deleteMessage;
  void editingId;
  void setEditingId;
  void editingBody;
  void setEditingBody;
  void messages;
  void activeRoomTitle;
  void handleCreateRoom;
  void handleSend;

  const isConversationRoute = matchPath("/chat/u/:userId", location.pathname) !== null;
  const isFavsRoute = matchPath("/chat/favs", location.pathname) !== null;
  const isAccountRoute = matchPath("/chat/account", location.pathname) !== null;
  const isSettingsRoute = matchPath("/chat/settings", location.pathname) !== null;
  const isChatHomeRoute = matchPath("/chat", location.pathname) !== null;

  const renderRouteContent = () => {
    if (isConversationRoute) {
      return <ChatConversationRoute />;
    }
    if (isFavsRoute) {
      return (
        <div className="chat-route-placeholder" data-no-drag="true">
          Favorites
        </div>
      );
    }
    if (isAccountRoute) {
      return <ChatAccountRoute />;
    }
    if (isSettingsRoute) {
      return <ChatSettingsRoute />;
    }
    if (isChatHomeRoute) {
      return <ChatHomeLayout />;
    }
    return <ChatHomeLayout />;
  };

  return (
    <ChatModuleLayout
      header={null}
      renderCompact={() => (
        <div className="chat-body-empty" data-no-drag="true">
          {renderRouteContent()}
        </div>
      )}
      renderWide={() => (
        <div className="chat-body-empty" data-no-drag="true">
          {renderRouteContent()}
        </div>
      )}
    />
  );
}
