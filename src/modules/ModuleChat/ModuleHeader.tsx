import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { FaRegHeart, IoSettingsOutline } from "../../shared/ui/icons";
import { BaseIconButton, BasePillInput } from "../../shared/ui";
import { StoryItem } from "./StoryItem";
import "./ModuleHeader.css";

type HeaderStory = {
  id: string;
  name: string;
  avatar?: string | null;
};

type ModuleHeaderProps = {
  onSettingsClick?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  stories?: HeaderStory[];
  onOpenStory?: (storyId: string) => void;
};

export function ModuleHeader({
  onSettingsClick,
  searchValue = "",
  onSearchChange,
  onSearchKeyDown,
  stories = [],
  onOpenStory,
}: ModuleHeaderProps) {
  return (
    <header className="module-header" data-no-drag="true">
      <div className="module-header-top-row" data-no-drag="true">
        <BasePillInput
          placeholder="Pesquisar usuarios..."
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <BaseIconButton aria-label="Favoritos">
          <FaRegHeart size={17} />
        </BaseIconButton>
        <BaseIconButton aria-label="Configuracoes" onClick={onSettingsClick}>
          <IoSettingsOutline size={17} />
        </BaseIconButton>
      </div>

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
