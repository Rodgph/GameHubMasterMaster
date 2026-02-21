import { ChatList } from "../components";

type ConversationListItem = {
  userId: string;
  username: string;
  avatarUrl?: string;
  lastMessage: string;
};

type ChatHomeRouteProps = {
  items: ConversationListItem[];
  onOpenUserId: (userId: string) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; userId: string }) => void;
};

export function ChatHomeRoute({ items, onOpenUserId, onOpenContextMenu }: ChatHomeRouteProps) {
  return (
    <ChatList
      items={items}
      onOpenUserId={onOpenUserId}
      onOpenContextMenu={onOpenContextMenu}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
