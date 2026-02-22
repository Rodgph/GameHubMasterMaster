import { ChatList } from "../components";

type ConversationListItem = {
  userId: string;
  roomId?: string;
  username: string;
  avatarUrl?: string;
  lastMessage: string;
};

type ChatHomeRouteProps = {
  items: ConversationListItem[];
  currentUserId: string | null;
  onOpenUserId: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; userId: string }) => void;
};

export function ChatHomeRoute({ items, currentUserId, onOpenUserId, onOpenContextMenu }: ChatHomeRouteProps) {
  return (
    <ChatList
      items={items}
      currentUserId={currentUserId}
      onOpenUserId={onOpenUserId}
      onOpenContextMenu={onOpenContextMenu}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
