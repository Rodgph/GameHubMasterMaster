import { FaRegHeart } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { BaseIconButton, BasePillInput } from "../../shared/ui";
import { StoryItem } from "./StoryItem";
import "./ModuleHeader.css";

const mockStories = [
  { id: "1", name: "Lana", avatar: "https://i.pravatar.cc/130?img=5" },
  { id: "2", name: "Pedro", avatar: "https://i.pravatar.cc/130?img=12" },
  { id: "3", name: "Maya", avatar: "https://i.pravatar.cc/130?img=32" },
  { id: "4", name: "Rafa", avatar: "https://i.pravatar.cc/130?img=22" },
  { id: "5", name: "Sofia", avatar: "https://i.pravatar.cc/130?img=47" },
];

type ModuleHeaderProps = {
  onSettingsClick?: () => void;
};

export function ModuleHeader({ onSettingsClick }: ModuleHeaderProps) {
  return (
    <header className="module-header" data-no-drag="true">
      <div className="module-header-top-row" data-no-drag="true">
        <BasePillInput placeholder="Pesquisar usuarios..." />
        <BaseIconButton aria-label="Favoritos">
          <FaRegHeart size={17} />
        </BaseIconButton>
        <BaseIconButton aria-label="Configuracoes" onClick={onSettingsClick}>
          <IoSettingsOutline size={17} />
        </BaseIconButton>
      </div>

      <div className="module-header-stories-row" data-no-drag="true">
        {mockStories.map((story) => (
          <StoryItem key={story.id} name={story.name} avatar={story.avatar} />
        ))}
      </div>
    </header>
  );
}
