import { StoryItem } from "./StoryItem";
import "./ModuleHeader.css";

type HeaderStory = {
  id: string;
  name: string;
  avatar?: string | null;
};

type ModuleHeaderProps = {
  stories?: HeaderStory[];
  onOpenStory?: (storyId: string) => void;
};

export function ModuleHeader({ stories = [], onOpenStory }: ModuleHeaderProps) {
  return (
    <header className="module-header" data-no-drag="true">
      {stories.length > 0 ? (
        <div className="module-header-stories-row" data-no-drag="true">
          {stories.map((story) => (
            <StoryItem
              key={story.id}
              name={story.name}
              avatar={story.avatar}
              onClick={() => onOpenStory?.(story.id)}
            />
          ))}
        </div>
      ) : null}
    </header>
  );
}
