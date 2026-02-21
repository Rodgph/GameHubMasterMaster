import { useMemo } from "react";
import { ChatListItem } from "../ChatListItem/ChatListItem";
import "./ChatList.css";

const mockChatUsers = [
  {
    userId: "u1",
    username: "Lana",
    lastMessage: "Bora fechar o layout hoje?",
    avatarUrl: "https://i.pravatar.cc/120?img=5",
  },
  {
    userId: "u2",
    username: "Pedro",
    lastMessage: "Subi os ajustes do worker com D1.",
    avatarUrl: "https://i.pravatar.cc/120?img=12",
  },
  {
    userId: "u3",
    username: "Maya",
    lastMessage: "Testei em duas janelas, realtime ok.",
    avatarUrl: "https://i.pravatar.cc/120?img=32",
  },
  {
    userId: "u4",
    username: "Rafa",
    lastMessage: "Vou cuidar do feed depois do chat.",
    avatarUrl: "https://i.pravatar.cc/120?img=22",
  },
];

type ChatListProps = {
  onOpenUserId?: (userId: string) => void;
  onPeekUserId?: (userId: string) => void;
};

export function ChatList({ onOpenUserId, onPeekUserId }: ChatListProps) {
  const users = useMemo(() => mockChatUsers, []);

  return (
    <section className="chat-list" data-no-drag="true">
      {users.map((user) => (
        <ChatListItem
          key={user.userId}
          userId={user.userId}
          username={user.username}
          lastMessage={user.lastMessage}
          avatarUrl={user.avatarUrl}
          onOpenUserId={(userId) => onOpenUserId?.(userId)}
          onPeekUserId={(userId) => onPeekUserId?.(userId)}
        />
      ))}
    </section>
  );
}
