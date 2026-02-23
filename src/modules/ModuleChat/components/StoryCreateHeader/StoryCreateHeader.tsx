import { BaseIconButton } from "../../../../shared/ui";
import { FaCheck, FiLayout, GoPencil, HiOutlineMicrophone, IoMdAttach, IoMdMusicalNote } from "../../../../shared/ui/icons";
import "./StoryCreateHeader.css";

type StoryCreateMode = "text" | "music" | "layout" | "voice";

type StoryCreateHeaderProps = {
  selectedMode: StoryCreateMode;
  onSelectMode: (mode: StoryCreateMode) => void;
  storyText: string;
  onStoryTextChange: (value: string) => void;
  onUploadClick: () => void;
  onPublish: () => void;
  canPublish: boolean;
};

export function StoryCreateHeader({
  selectedMode,
  onSelectMode,
  storyText,
  onStoryTextChange,
  onUploadClick,
  onPublish,
  canPublish,
}: StoryCreateHeaderProps) {
  return (
    <header className="story-create-header" data-no-drag="true">
      <div className="story-create-header-modes" data-no-drag="true">
        <BaseIconButton
          aria-label="Story de texto"
          className={`story-create-header-icon${selectedMode === "text" ? " story-create-header-icon-active" : ""}`}
          onClick={() => onSelectMode("text")}
        >
          <GoPencil size={17} />
        </BaseIconButton>
        <BaseIconButton
          aria-label="Story com musica"
          className={`story-create-header-icon${selectedMode === "music" ? " story-create-header-icon-active" : ""}`}
          onClick={() => onSelectMode("music")}
        >
          <IoMdMusicalNote size={17} />
        </BaseIconButton>
        <BaseIconButton
          aria-label="Story de layout"
          className={`story-create-header-icon${selectedMode === "layout" ? " story-create-header-icon-active" : ""}`}
          onClick={() => onSelectMode("layout")}
        >
          <FiLayout size={17} />
        </BaseIconButton>
        <BaseIconButton
          aria-label="Story de voz"
          className={`story-create-header-icon${selectedMode === "voice" ? " story-create-header-icon-active" : ""}`}
          onClick={() => onSelectMode("voice")}
        >
          <HiOutlineMicrophone size={17} />
        </BaseIconButton>
        <BaseIconButton aria-label="Upload story" style={{ marginLeft: "auto" }} onClick={onUploadClick}>
          <IoMdAttach size={16} />
        </BaseIconButton>
        <BaseIconButton aria-label="Publicar story" disabled={!canPublish} onClick={onPublish}>
          <FaCheck size={14} />
        </BaseIconButton>
      </div>
      {selectedMode === "text" ? (
        <textarea
          className="chat-create-story-textarea"
          placeholder="Escreva sua historia..."
          value={storyText}
          onChange={(event) => onStoryTextChange(event.target.value)}
        />
      ) : null}
    </header>
  );
}
