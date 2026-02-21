import { useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  ConversationFooter,
  ConversationHeader,
  ConversationTopUserCard,
  MessageList,
} from "./conversation/components";
import { useAutoScroll } from "./conversation/hooks/useAutoScroll";
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
  const { messages, send } = useConversationMessages(conversationUserId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useAutoScroll(scrollRef, messages);

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
    <section className="chat-conversation-page" data-no-drag="true">
      <ConversationHeader storyCount={5} activeStoryIndex={0} />

      <div className="chat-conversation-top" data-no-drag="true">
        <ConversationTopUserCard
          username={user.username}
          subtitle={user.subtitle}
          avatarUrl={user.avatarUrl}
        />
      </div>

      <div className="chat-conversation-scroll" ref={scrollRef} data-no-drag="true">
        <MessageList messages={messages} />
      </div>
      <ConversationFooter onSend={send} />
    </section>
  );
}
