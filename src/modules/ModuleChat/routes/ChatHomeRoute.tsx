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
};

export function ChatHomeRoute({ items, onOpenUserId }: ChatHomeRouteProps) {
  return (
    <ChatList
      items={items}
      onOpenUserId={onOpenUserId}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
