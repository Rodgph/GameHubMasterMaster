import { AvatarCircle, TextBlock } from "../../../../../../shared/ui";
import "./ConversationTopUserCard.css";

type ConversationTopUserCardProps = {
  username: string;
  subtitle?: string;
  avatarUrl?: string;
  onClick?: () => void;
};

export function ConversationTopUserCard({
  username,
  subtitle = "online",
  avatarUrl,
  onClick,
}: ConversationTopUserCardProps) {
  const clickable = typeof onClick === "function";

  return (
    <section
      className={`conversation-top-user-card${clickable ? " is-clickable" : ""}`}
      data-no-drag="true"
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!clickable) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onClick?.();
      }}
    >
      <AvatarCircle src={avatarUrl} alt={username} size={60} />
      <TextBlock title={username} subtitle={subtitle} />
    </section>
  );
}
