import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { FiCornerUpLeft } from "../../../../../../../shared/ui/icons";
import type { Message } from "../../../types/message";
import { MessageMeta } from "../MessageMeta/MessageMeta";
import { messageVariants, TRANSITIONS } from "../../../../../../../shared/ui/Animated";
import "./MessageBubble.css";

type MessageBubbleProps = {
  message: Message;
  isOutgoing: boolean;
  onContextMenu?: (event: MouseEvent<HTMLElement>, message: Message, isOutgoing: boolean) => void;
};

export function MessageBubble({ message, isOutgoing, onContextMenu }: MessageBubbleProps) {
  const lines = message.text.split("\n");
  const replyLines: Array<{ author: string; text: string }> = [];
  let bodyStartIndex = 0;

  for (const line of lines) {
    if (!line.startsWith("> ")) break;
    const content = line.slice(2).trim();
    const separatorIndex = content.indexOf(":");
    if (separatorIndex > 0) {
      replyLines.push({
        author: content.slice(0, separatorIndex).trim(),
        text: content.slice(separatorIndex + 1).trim(),
      });
    } else {
      replyLines.push({ author: "Mensagem", text: content });
    }
    bodyStartIndex += 1;
  }

  const bodyText = lines.slice(bodyStartIndex).join("\n").trim() || message.text;

  const isImage = message.type === "image" && Boolean(message.mediaUrl);
  const isAudio = message.type === "audio" && Boolean(message.mediaUrl);
  const isFile = message.type === "file";
  const reactions = message.reactions ?? [];

  return (
    <motion.div
      className={`message-bubble-row ${isOutgoing ? "outgoing" : "incoming"}`}
      data-no-drag="true"
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={TRANSITIONS.smooth}
      layout
    >
      <motion.article
        className={`message-bubble ${isOutgoing ? "outgoing" : "incoming"}`}
        onContextMenu={(event) => onContextMenu?.(event, message, isOutgoing)}
        data-no-drag="true"
        whileHover={{ scale: 1.02 }}
        transition={TRANSITIONS.hover}
      >
        {replyLines.length > 0 ? (
          <div className="message-bubble-replies" data-no-drag="true">
            {replyLines.map((item, index) => (
              <div key={`${message.id}-reply-${index}`} className="message-bubble-reply-line">
                <span className="message-bubble-reply-title">
                  <FiCornerUpLeft size={12} />
                  <strong>{item.author}</strong>
                </span>
                <span className="message-bubble-reply-text">{item.text}</span>
              </div>
            ))}
          </div>
        ) : null}
        {isImage ? (
          <figure className="message-bubble-media-wrap">
            <img src={message.mediaUrl ?? ""} alt={message.text || "imagem"} className="message-bubble-image" />
            {reactions.length > 0 ? (
              <div className="message-bubble-reactions-overlay" data-no-drag="true">
                {reactions.map((reaction) => (
                  <span
                    key={`${message.id}-reaction-${reaction.emoji}`}
                    className={`message-bubble-reaction-chip${reaction.reactedByMe ? " active" : ""}`}
                  >
                    {reaction.emoji} {reaction.count}
                  </span>
                ))}
              </div>
            ) : null}
          </figure>
        ) : null}
        {isAudio ? (
          <div className="message-bubble-audio-wrap">
            <audio controls preload="metadata" src={message.mediaUrl ?? ""} className="message-bubble-audio" />
            {message.audioDurationMs ? (
              <span className="message-bubble-audio-duration">
                {Math.floor(message.audioDurationMs / 60000)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor((message.audioDurationMs % 60000) / 1000)
                  .toString()
                  .padStart(2, "0")}
              </span>
            ) : null}
          </div>
        ) : null}
        {isFile ? (
          <a
            href={message.mediaUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="message-bubble-file-link"
          >
            {message.text || "Arquivo"}
          </a>
        ) : null}
        {!isImage && !isAudio && !isFile ? <p className="message-bubble-body">{bodyText}</p> : null}
        <MessageMeta message={message} />
      </motion.article>
    </motion.div>
  );
}
