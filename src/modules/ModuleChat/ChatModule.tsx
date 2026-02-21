import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../core/stores/sessionStore";
import { useChatStore } from "./chatStore";
import "./chat.css";

export function ChatModule() {
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

  return (
    <section className="chat-module" data-no-drag="true">
      <aside className="chat-sidebar" data-no-drag="true">
        <header className="chat-sidebar-header">
          <h3>Salas</h3>
          <small>{loadingRooms ? "carregando..." : `${rooms.length} sala(s)`}</small>
        </header>
        <div className="chat-create-room" data-no-drag="true">
          <input
            value={roomTitle}
            onChange={(event) => setRoomTitle(event.target.value)}
            placeholder="Nova sala"
            data-no-drag="true"
          />
          <button type="button" onClick={() => void handleCreateRoom()} data-no-drag="true">
            Criar
          </button>
        </div>
        <div className="chat-room-list" data-scroll-region>
          {rooms.map((room) => (
            <button
              key={room.roomId}
              type="button"
              className={`chat-room-item ${room.roomId === activeRoomId ? "active" : ""}`}
              onClick={() => void openRoom(room.roomId)}
              data-no-drag="true"
            >
              <strong>{room.title || "Sala sem titulo"}</strong>
              <span>{room.lastMessageAt ?? "sem mensagens"}</span>
            </button>
          ))}
        </div>
      </aside>

      <article className="chat-main" data-no-drag="true">
        <header className="chat-main-header">
          <h4>{activeRoomTitle}</h4>
          <small>{wsStatus}</small>
        </header>
        <div className="chat-messages" data-scroll-region>
          {loadingMessages ? <p>Carregando mensagens...</p> : null}
          {messages.map((message) => {
            const own = message.userId === user?.id;
            const isEditing = editingId === message.id;
            return (
              <article key={message.id} className={`chat-message ${own ? "own" : ""}`}>
                <header>
                  <span>{message.userId.slice(0, 8)}</span>
                  <small>{message.createdAt}</small>
                </header>
                {message.deletedAt ? (
                  <p className="chat-message-deleted">[mensagem removida]</p>
                ) : isEditing ? (
                  <div className="chat-edit-row">
                    <input
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      data-no-drag="true"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void editMessage(message.id, editingBody);
                        setEditingId(null);
                        setEditingBody("");
                      }}
                      data-no-drag="true"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingBody("");
                      }}
                      data-no-drag="true"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p>{message.body}</p>
                )}
                {own && !message.deletedAt && !isEditing ? (
                  <footer>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(message.id);
                        setEditingBody(message.body);
                      }}
                      data-no-drag="true"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteMessage(message.id)}
                      data-no-drag="true"
                    >
                      Excluir
                    </button>
                  </footer>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="chat-input-row" data-no-drag="true">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Digite uma mensagem"
            data-no-drag="true"
          />
          <button type="button" onClick={() => void handleSend()} data-no-drag="true">
            Enviar
          </button>
        </div>
        {error ? <p className="chat-error">{error}</p> : null}
      </article>
    </section>
  );
}
