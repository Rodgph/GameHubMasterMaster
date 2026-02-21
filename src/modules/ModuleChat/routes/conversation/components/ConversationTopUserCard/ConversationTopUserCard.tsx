import { AvatarCircle, TextBlock } from "../../../../../../shared/ui";
import "./ConversationTopUserCard.css";

type ConversationTopUserCardProps = {
  username: string;
  subtitle?: string;
  avatarUrl?: string;
};

export function ConversationTopUserCard({
  username,
  subtitle = "online",
  avatarUrl,
}: ConversationTopUserCardProps) {
  return (
    <section className="conversation-top-user-card" data-no-drag="true">
      <AvatarCircle src={avatarUrl} alt={username} size={60} />
      <TextBlock title={username} subtitle={subtitle} />
    </section>
  );
}
