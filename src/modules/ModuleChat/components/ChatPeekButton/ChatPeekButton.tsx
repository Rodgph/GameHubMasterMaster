import { FiExternalLink } from "react-icons/fi";
import { BaseIconButton } from "../../../../shared/ui";

type ChatPeekButtonProps = {
  userId: string;
  onPeek: (userId: string) => void;
};

export function ChatPeekButton({ userId, onPeek }: ChatPeekButtonProps) {
  return (
    <BaseIconButton
      aria-label="Expandir conversa"
      onClick={(event) => {
        event.stopPropagation();
        onPeek(userId);
      }}
    >
      <FiExternalLink size={16} />
    </BaseIconButton>
  );
}
