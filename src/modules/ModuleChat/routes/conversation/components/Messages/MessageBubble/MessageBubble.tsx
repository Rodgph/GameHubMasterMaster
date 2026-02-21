import type { Message } from "../../../types/message";
import { MessageMeta } from "../MessageMeta/MessageMeta";
import "./MessageBubble.css";

type MessageBubbleProps = {
  message: Message;
  isOutgoing: boolean;
};

export function MessageBubble({ message, isOutgoing }: MessageBubbleProps) {
  return (
    <div
      className={`message-bubble-row ${isOutgoing ? "outgoing" : "incoming"}`}
      data-no-drag="true"
    >
      <article
        className={`message-bubble ${isOutgoing ? "outgoing" : "incoming"}`}
        data-no-drag="true"
      >
        <p className="message-bubble-body">{message.text}</p>
        <MessageMeta message={message} />
      </article>
    </div>
  );
}
