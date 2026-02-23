import { BaseIconButton, BasePillInput } from "../../../../shared/ui";
import { HiOutlineMicrophone, RiEmotionLaughLine } from "../../../../shared/ui/icons";

type StoryReplyFooterProps = {
  value: string;
  onChange: (value: string) => void;
  onOpenEmoji?: () => void;
  onRecordVoice?: () => void;
};

export function StoryReplyFooter({
  value,
  onChange,
  onOpenEmoji,
  onRecordVoice,
}: StoryReplyFooterProps) {
  return (
    <footer className="story-reply-footer" data-no-drag="true">
      <BasePillInput
        placeholder="Responder story..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <BaseIconButton aria-label="Emojis" onClick={() => onOpenEmoji?.()}>
        <RiEmotionLaughLine size={16} />
      </BaseIconButton>
      <BaseIconButton aria-label="Gravar voz" onClick={() => onRecordVoice?.()}>
        <HiOutlineMicrophone size={16} />
      </BaseIconButton>
    </footer>
  );
}
