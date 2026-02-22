import { useEffect, useRef, useState } from "react";
import { getMessageEdits, type ChatMessageEditRecord } from "../../../../../data/messages.repository";
import type { Message } from "../../../types/message";
import "./MessageMeta.css";

type MessageMetaProps = {
  message: Message;
};

export function MessageMeta({ message }: MessageMetaProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessageEditRecord[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const time = new Date(message.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const hasEditHistory = Boolean(message.editedAt) || history.length > 0;

  useEffect(() => {
    if (!message.editedAt) {
      setHistory([]);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        const rows = await getMessageEdits(message.id);
        if (!active) return;
        setHistory(rows);
      } catch {
        if (!active) return;
        setHistory([]);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [message.editedAt, message.id]);

  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!wrapRef.current.contains(target)) {
        setHistoryOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [historyOpen]);

  return (
    <div className="message-meta-wrap" data-no-drag="true" ref={wrapRef}>
      <span className="message-meta" data-no-drag="true">
        {time}
        {message.status === "sending" ? " - Enviando" : null}
        {message.status === "failed" ? " - Falhou" : null}
      </span>
      {hasEditHistory ? (
        <button
          type="button"
          className="message-meta-edited-button"
          onClick={() => setHistoryOpen((prev) => !prev)}
        >
          editada
        </button>
      ) : null}
      {historyOpen && history.length > 0 ? (
        <div className="message-meta-history">
          {history.map((item, index) => (
            <div key={`${message.id}-history-${index}`} className="message-meta-history-item">
              <span className="message-meta-history-time">
                {new Date(item.created_at).toLocaleDateString("pt-BR")}{" "}
                {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="message-meta-history-text">{item.previous_text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
