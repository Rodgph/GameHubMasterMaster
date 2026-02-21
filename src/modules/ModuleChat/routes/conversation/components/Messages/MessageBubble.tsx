import { MessageMeta } from "./MessageMeta";
import "./MessageBubble.css";

type MessageBubbleProps = {
  body: string;
  time: string;
  outgoing?: boolean;
};

export function MessageBubble({ body, time, outgoing = false }: MessageBubbleProps) {
  return (
    <div className={`message-bubble-row ${outgoing ? "outgoing" : "incoming"}`} data-no-drag="true">
      <article
        className={`message-bubble ${outgoing ? "outgoing" : "incoming"}`}
        data-no-drag="true"
      >
        <p className="message-bubble-body">{body}</p>
        <MessageMeta time={time} />
      </article>
    </div>
  );
}
