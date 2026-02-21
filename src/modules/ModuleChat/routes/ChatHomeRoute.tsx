import { useNavigate } from "react-router-dom";
import { ChatList } from "../components";
import { useChatUsers } from "../hooks/useChatUsers";

export function ChatHomeRoute() {
  const navigate = useNavigate();
  const { users } = useChatUsers();

  const items = users.map((user) => ({
    userId: user.id,
    username: user.username,
    avatarUrl: user.avatar_url ?? undefined,
    lastMessage: "Toque para abrir a conversa",
  }));

  return (
    <ChatList
      items={items}
      onOpenUserId={(userId) => navigate(`/chat/u/${userId}`)}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
