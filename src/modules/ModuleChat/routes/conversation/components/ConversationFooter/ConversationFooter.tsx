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
};

export function ConversationFooter({
  onSend,
  onOpenEmoji,
  onAttach,
  onRecord,
}: ConversationFooterProps) {
  const [message, setMessage] = useState("");

  return (
    <footer className="conversation-footer" data-no-drag="true">
      <BasePillInput
        placeholder="Mensagem..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <BaseIconButton
        aria-label="Enviar"
        disabled={!message.trim()}
        onClick={() => onSend?.(message)}
      >
        <LuSend size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Emojis" onClick={() => onOpenEmoji?.()}>
        <RiEmotionLaughLine size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Anexar" onClick={() => onAttach?.()}>
        <IoMdAttach size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Gravar voz" onClick={() => onRecord?.()}>
        <HiOutlineMicrophone size={16} />
      </BaseIconButton>
    </footer>
  );
}
