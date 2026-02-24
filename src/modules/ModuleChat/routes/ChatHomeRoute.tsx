import { ChatList } from "../components";

export type ConversationListItem = {
  userId: string;
  roomId?: string;
  conversationType: "dm" | "group";
  username: string;
  avatarUrl?: string;
  lastMessage: string;
};

type ChatHomeRouteProps = {
  items: ConversationListItem[];
  currentUserId: string | null;
  onOpenItem: (item: ConversationListItem) => void;
  onOpenContextMenu?: (payload: { x: number; y: number; item: ConversationListItem }) => void;
};

export function ChatHomeRoute({ items, currentUserId, onOpenItem, onOpenContextMenu }: ChatHomeRouteProps) {
  return (
    <ChatList
      items={items}
      currentUserId={currentUserId}
      onOpenItem={onOpenItem}
      onOpenContextMenu={onOpenContextMenu}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
