import type { Message } from "../../../types/message";
import { DaySeparator } from "../DaySeparator";
import { EmptyMessages } from "../EmptyMessages/EmptyMessages";
import { MessageBubble } from "../MessageBubble/MessageBubble";
import "./MessageList.css";

type MessageListProps = {
  messages: Message[];
};

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <section className="message-list" data-no-drag="true">
        <EmptyMessages />
      </section>
    );
  }

  return (
    <section className="message-list" data-no-drag="true">
      <DaySeparator label="Hoje" />
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} isOutgoing={message.senderId === "me"} />
      ))}
    </section>
  );
}
