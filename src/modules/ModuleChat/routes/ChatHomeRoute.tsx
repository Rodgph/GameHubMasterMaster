import { useNavigate } from "react-router-dom";
import { ChatList } from "../components";

export function ChatHomeRoute() {
  const navigate = useNavigate();

  return (
    <ChatList
      onOpenUserId={(userId) => navigate(`/chat/u/${userId}`)}
      onPeekUserId={(userId) => {
        void userId;
      }}
    />
  );
}
