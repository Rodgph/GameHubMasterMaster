import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AvatarCircle } from "../../../shared/ui";
import { getChatProfileById } from "../data/users.repository";

export function ChatProfileRoute() {
  const { userId } = useParams();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [username, setUsername] = useState("Usuario");

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!userId) {
        setAvatarUrl(undefined);
        setUsername("Usuario");
        return;
      }

      try {
        const profile = await getChatProfileById(userId);
        if (!active) return;
        setAvatarUrl(profile?.avatar_url ?? undefined);
        setUsername(profile?.username || "Usuario");
      } catch {
        if (!active) return;
        setAvatarUrl(undefined);
        setUsername("Usuario");
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <section className="chat-profile-route" data-no-drag="true">
      <div className="chat-profile-photo-card" data-no-drag="true">
        <AvatarCircle src={avatarUrl} alt={username} size={140} />
      </div>
    </section>
  );
}
