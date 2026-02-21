import "./StoryItem.css";

type StoryItemProps = {
  name: string;
  avatar?: string | null;
  onClick?: () => void;
};

export function StoryItem({ name, avatar, onClick }: StoryItemProps) {
  return (
    <button className="story-item" type="button" data-no-drag="true" aria-label={name} onClick={onClick}>
      {avatar ? <img src={avatar} alt={name} className="story-item-image" draggable={false} /> : null}
      <span className="story-item-name">{name}</span>
    </button>
  );
}
