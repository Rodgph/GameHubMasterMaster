import { useParams } from "react-router-dom";

export function ChatProfileRoute() {
  const { userId } = useParams();

  return (
    <div className="chat-route-placeholder" data-no-drag="true">
      Perfil: {userId ?? "desconhecido"}
    </div>
  );
}
