import { ChatPeekButton } from "../ChatPeekButton/ChatPeekButton";
import { AvatarCircle, TextBlock } from "../../../../shared/ui";
import "./ChatListItem.css";

type ChatListItemProps = {
  userId: string;
  username: string;
  lastMessage: string;
  avatarUrl?: string;
  onOpenUserId: (userId: string) => void;
  onPeekUserId: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; userId: string }) => void;
};

export function ChatListItem({
  userId,
  username,
  lastMessage,
  avatarUrl,
  onOpenUserId,
  onPeekUserId,
  onOpenContextMenu,
}: ChatListItemProps) {
  return (
    <article
      className="chat-list-item"
      onClick={() => onOpenUserId(userId)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu?.({ x: event.clientX, y: event.clientY, userId });
      }}
      data-no-drag="true"
    >
      <AvatarCircle src={avatarUrl} alt={username} size={60} />
      <TextBlock title={username} subtitle={lastMessage} />
      <ChatPeekButton userId={userId} onPeek={onPeekUserId} />
    </article>
  );
}
