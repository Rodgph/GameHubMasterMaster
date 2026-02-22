import { useState } from "react";
import { HiOutlineMicrophone } from "react-icons/hi";
import { IoMdAttach } from "react-icons/io";
import { LuSend } from "react-icons/lu";
import { RiEmotionLaughLine } from "react-icons/ri";
import { BaseIconButton, BasePillInput } from "../../../../../../shared/ui";
import "./ConversationFooter.css";

type ConversationFooterProps = {
  onSend?: (message: string) => void;
  onOpenEmoji?: () => void;
  onAttach?: () => void;
  onRecord?: () => void;
  isRecording?: boolean;
  value?: string;
  onChangeMessage?: (value: string) => void;
  replyItems?: Array<{ id: string; text: string; author?: string }>;
  onRemoveReplyItem?: (id: string) => void;
};

export function ConversationFooter({
  onSend,
  onOpenEmoji,
  onAttach,
  onRecord,
  isRecording = false,
  value,
  onChangeMessage,
  replyItems = [],
  onRemoveReplyItem,
}: ConversationFooterProps) {
  const [internalMessage, setInternalMessage] = useState("");
  const message = value ?? internalMessage;
  const trimmed = message.trim();

  const handleSend = () => {
    if (!trimmed) return;
    onSend?.(trimmed);
    if (value !== undefined) {
      onChangeMessage?.("");
    } else {
      setInternalMessage("");
    }
  };

  return (
    <footer className="conversation-footer" data-no-drag="true">
      {replyItems.length > 0 ? (
        <div className="conversation-footer-replies" data-no-drag="true">
          {replyItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="conversation-footer-reply-item"
              onClick={() => onRemoveReplyItem?.(item.id)}
            >
              <span className="conversation-footer-reply-text">
                {item.author ? `${item.author}: ` : ""}
                {item.text}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <BasePillInput
        placeholder="Mensagem..."
        value={message}
        onChange={(event) => {
          const next = event.target.value;
          if (value !== undefined) {
            onChangeMessage?.(next);
          } else {
            setInternalMessage(next);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSend();
          }
        }}
      />
      <BaseIconButton aria-label="Enviar" disabled={!trimmed} onClick={handleSend}>
        <LuSend size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Emojis" onClick={() => onOpenEmoji?.()}>
        <RiEmotionLaughLine size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Anexar" onClick={() => onAttach?.()}>
        <IoMdAttach size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Gravar voz" onClick={() => onRecord?.()} data-recording={isRecording}>
        <HiOutlineMicrophone size={16} />
      </BaseIconButton>
    </footer>
  );
}
