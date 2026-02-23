import { BaseIconButton } from "../../../../shared/ui";
import { IoIosArrowDown } from "../../../../shared/ui/icons";

type ChatPeekButtonProps = {
  userId: string;
  onPeek: (userId: string) => void;
  className?: string;
};

export function ChatPeekButton({ userId, onPeek, className }: ChatPeekButtonProps) {
  return (
    <BaseIconButton
      aria-label="Expandir conversa"
      className={className ?? "chat-peek-button"}
      onClick={(event) => {
        event.stopPropagation();
        onPeek(userId);
      }}
    >
      <IoIosArrowDown size={16} />
    </BaseIconButton>
  );
}
