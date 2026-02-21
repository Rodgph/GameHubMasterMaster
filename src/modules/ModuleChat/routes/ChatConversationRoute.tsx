import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ConversationFooter,
  ConversationHeader,
  ConversationTopUserCard,
  MessageList,
} from "./conversation/components";
import { useConversationMessages } from "./conversation/hooks/useConversationMessages";

const userMockMap: Record<string, { username: string; subtitle: string; avatarUrl: string }> = {
  u1: { username: "Lana", subtitle: "online", avatarUrl: "https://i.pravatar.cc/120?img=5" },
  u2: {
    username: "Pedro",
    subtitle: "last seen 2m",
    avatarUrl: "https://i.pravatar.cc/120?img=12",
  },
  u3: { username: "Maya", subtitle: "last seen 5m", avatarUrl: "https://i.pravatar.cc/120?img=32" },
  u4: { username: "Rafa", subtitle: "online", avatarUrl: "https://i.pravatar.cc/120?img=22" },
};

export function ChatConversationRoute() {
  const { userId } = useParams();
  const conversationUserId = userId ?? "unknown";
  const { messages, sendLocal } = useConversationMessages(conversationUserId);

  const user = useMemo(() => {
    if (!userId) {
      return {
        username: "Unknown user",
        subtitle: "offline",
        avatarUrl: "",
      };
    }

    return (
      userMockMap[userId] ?? {
        username: `User ${userId}`,
        subtitle: "offline",
        avatarUrl: "",
      }
    );
  }, [userId]);

  return (
    <section className="chat-conversation-route" data-no-drag="true">
      <ConversationHeader storyCount={5} activeStoryIndex={0} />

      <div className="chat-conversation-body" data-no-drag="true">
        <ConversationTopUserCard
          username={user.username}
          subtitle={user.subtitle}
          avatarUrl={user.avatarUrl}
        />
      </div>

      <MessageList messages={messages} />
      <ConversationFooter onSend={sendLocal} />
    </section>
  );
}
