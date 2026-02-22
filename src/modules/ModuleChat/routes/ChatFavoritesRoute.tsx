import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFavorites } from "../data/messages.repository";

type FavoriteItem = {
  favorited_at: string;
  message: {
    id: string;
    room_id: string;
    body_text: string | null;
    type: string;
    created_at: string;
  };
};

export function ChatFavoritesRoute() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const rows = await getFavorites();
        if (!active) return;
        setFavorites(rows as unknown as FavoriteItem[]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="chat-route-placeholder" data-no-drag="true">
        Carregando favoritos...
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="chat-route-placeholder" data-no-drag="true">
        Sem mensagens favoritas
      </div>
    );
  }

  return (
    <section className="chat-list" data-no-drag="true">
      {favorites.map((item) => (
        <article
          key={item.message.id}
          className="chat-list-item"
          data-no-drag="true"
          onClick={() =>
            navigate(`/chat/conversation/${item.message.room_id}`, {
              state: { focusMessageId: item.message.id },
            })
          }
        >
          <div className="chat-list-item-content" data-no-drag="true">
            <div className="chat-list-item-title-row" data-no-drag="true">
              <span className="chat-list-item-title">Mensagem favorita</span>
            </div>
            <span className="chat-list-item-subtitle">{item.message.body_text || "[midia]"}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

