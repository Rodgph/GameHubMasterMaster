import { ChatListItem } from "../ChatListItem/ChatListItem";
import "./ChatList.css";

export type ChatListItemModel = {
  userId: string;
  roomId?: string;
  username: string;
  lastMessage: string;
  avatarUrl?: string;
};

type ChatListProps = {
  items: ChatListItemModel[];
  currentUserId: string | null;
  onOpenUserId?: (userId: string) => void;
  onPeekUserId?: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; userId: string }) => void;
};

export function ChatList({
  items,
  currentUserId,
  onOpenUserId,
  onPeekUserId,
  onOpenContextMenu,
}: ChatListProps) {
  return (
    <section className="chat-list" data-no-drag="true">
      {items.map((user) => (
        <ChatListItem
          key={user.userId}
          userId={user.userId}
          roomId={user.roomId}
          currentUserId={currentUserId}
          username={user.username}
          lastMessage={user.lastMessage}
          avatarUrl={user.avatarUrl}
          onOpenUserId={(userId) => onOpenUserId?.(userId)}
          onPeekUserId={(userId) => onPeekUserId?.(userId)}
          onOpenContextMenu={onOpenContextMenu}
        />
      ))}
    </section>
  );
}
