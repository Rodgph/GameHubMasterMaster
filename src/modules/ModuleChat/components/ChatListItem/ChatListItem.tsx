import { useEffect, useMemo, useState } from "react";
import { ChatPeekButton } from "../ChatPeekButton/ChatPeekButton";
import {
  cloudChatGetMessages,
  cloudChatSendMessage,
  type ChatMessage,
} from "../../../../core/services/cloudflareApi";
import { getSupabaseClient } from "../../../../core/services/supabase";
import { ConversationFooter } from "../../routes/conversation/components";
import { AvatarCircle } from "../../../../shared/ui";
import "./ChatListItem.css";

type ChatListItemProps = {
  userId: string;
  roomId?: string;
  currentUserId: string | null;
  username: string;
  lastMessage: string;
  avatarUrl?: string;
  onOpenUserId: (userId: string) => void;
  onPeekUserId: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; userId: string }) => void;
};

export function ChatListItem({
  userId,
  roomId,
  currentUserId,
  username,
  lastMessage,
  avatarUrl,
  onOpenUserId,
  onPeekUserId,
  onOpenContextMenu,
}: ChatListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([]);

  const sortedPreviewMessages = useMemo(
    () => [...previewMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [previewMessages],
  );

  useEffect(() => {
    if (!expanded || !roomId) return;
    let active = true;

    const run = async () => {
      setLoadingPreview(true);
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await cloudChatGetMessages(token, roomId, { limit: 20 });
        if (!active) return;
        setPreviewMessages(response.messages);
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [expanded, roomId]);

  const handleSendPreview = async (body: string) => {
    if (!roomId || sendingPreview) return;
    const text = body.trim();
    if (!text) return;

    setSendingPreview(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await cloudChatSendMessage(token, roomId, text);
      setPreviewMessages((prev) => [...prev, response.message]);
    } finally {
      setSendingPreview(false);
    }
  };

  return (
    <article
      className={`chat-list-item${expanded ? " is-expanded" : ""}`}
      onClick={() => onOpenUserId(userId)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu?.({ x: event.clientX, y: event.clientY, userId });
      }}
      data-no-drag="true"
    >
      <AvatarCircle src={avatarUrl} alt={username} size={60} />
      <div className="chat-list-item-content" data-no-drag="true">
        <div className="chat-list-item-title-row" data-no-drag="true">
          <span className="chat-list-item-title">{username}</span>
          <ChatPeekButton
            userId={userId}
            onPeek={(id) => {
              onPeekUserId(id);
              setExpanded((prev) => !prev);
            }}
            className="chat-peek-inline"
          />
        </div>
        <span className="chat-list-item-subtitle">{lastMessage}</span>
        {expanded ? (
          <div className="chat-list-item-preview" data-no-drag="true" onClick={(event) => event.stopPropagation()}>
            {!roomId ? (
              <span className="chat-list-item-preview-empty">Abra a conversa para sincronizar este preview.</span>
            ) : loadingPreview ? (
              <span className="chat-list-item-preview-empty">Carregando...</span>
            ) : sortedPreviewMessages.length === 0 ? (
              <span className="chat-list-item-preview-empty">Sem mensagens ainda.</span>
            ) : (
              sortedPreviewMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-list-item-preview-bubble ${
                    message.userId === currentUserId ? "is-me" : "is-peer"
                  }`}
                >
                  {message.deletedAt ? "[mensagem removida]" : message.body}
                </div>
              ))
            )}
          </div>
        ) : null}
        {expanded ? (
          <div className="chat-list-item-preview-footer" data-no-drag="true" onClick={(event) => event.stopPropagation()}>
            <ConversationFooter onSend={(message) => void handleSendPreview(message)} />
            {sendingPreview ? <span className="chat-list-item-preview-empty">Enviando...</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
