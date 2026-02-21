import type { Message } from "../../../types/message";
import "./MessageMeta.css";

type MessageMetaProps = {
  message: Message;
};

export function MessageMeta({ message }: MessageMetaProps) {
  const time = new Date(message.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span className="message-meta" data-no-drag="true">
      {time}
      {message.status === "sending" ? " - Enviando" : null}
      {message.status === "failed" ? " - Falhou" : null}
    </span>
  );
}
