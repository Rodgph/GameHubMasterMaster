import { StoryIndicatorBars } from "../StoryIndicatorBars/StoryIndicatorBars";
import "./ConversationHeader.css";

type ConversationHeaderProps = {
  storyCount?: number;
  activeStoryIndex?: number;
};

export function ConversationHeader({
  storyCount = 5,
  activeStoryIndex = 0,
}: ConversationHeaderProps) {
  return (
    <header className="conversation-header" data-no-drag="true">
      <StoryIndicatorBars count={storyCount} activeIndex={activeStoryIndex} />
    </header>
  );
}
