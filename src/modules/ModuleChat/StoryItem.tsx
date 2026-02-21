import "./StoryItem.css";

type StoryItemProps = {
  name: string;
  avatar: string;
};

export function StoryItem({ name, avatar }: StoryItemProps) {
  return (
    <button className="story-item" type="button" data-no-drag="true" aria-label={name}>
      <img src={avatar} alt={name} className="story-item-image" draggable={false} />
      <span className="story-item-name">{name}</span>
    </button>
  );
}
