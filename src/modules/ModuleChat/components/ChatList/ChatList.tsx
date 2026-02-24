import { ChatListItem } from "../ChatListItem/ChatListItem";
import "./ChatList.css";

export type ChatListItemModel = {
  userId: string;
  roomId?: string;
  conversationType: "dm" | "group";
  username: string;
  lastMessage: string;
  avatarUrl?: string;
};

type ChatListProps = {
  items: ChatListItemModel[];
  currentUserId: string | null;
  onOpenItem?: (item: ChatListItemModel) => void;
  onPeekUserId?: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; item: ChatListItemModel }) => void;
};

export function ChatList({
  items,
  currentUserId,
  onOpenItem,
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
          conversationType={user.conversationType}
          username={user.username}
          lastMessage={user.lastMessage}
          avatarUrl={user.avatarUrl}
          onOpenItem={(item) => onOpenItem?.(item)}
          onPeekUserId={(userId) => onPeekUserId?.(userId)}
          onOpenContextMenu={onOpenContextMenu}
        />
      ))}
    </section>
  );
}
