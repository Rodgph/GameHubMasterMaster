import { useEffect } from "react";
import { useFeedStore } from "./feedStore";

type Props = {
  postId: string;
};

export function PostDataModal({ postId }: Props) {
  const close = useFeedStore((state) => state.setActivePostId);
  const loadPostData = useFeedStore((state) => state.loadPostData);
  const data = useFeedStore((state) => state.postDataByPostId[postId]);

  useEffect(() => {
    void loadPostData(postId);
  }, [loadPostData, postId]);

  return (
    <div className="feed-modal-overlay" data-no-drag="true" onClick={() => close(null)}>
      <div className="feed-modal" data-no-drag="true" onClick={(event) => event.stopPropagation()}>
        <div className="feed-modal-header">
          <strong>Dados do Post</strong>
          <button data-no-drag="true" type="button" onClick={() => close(null)}>
            Fechar
          </button>
        </div>
        {!data ? (
          <p className="feed-empty">Carregando...</p>
        ) : (
          <div className="feed-data-grid">
            <section>
              <h4>Metadata</h4>
              <p>Criado: {new Date(data.metadata.created_at).toLocaleString()}</p>
              <p>
                Editado:{" "}
                {data.metadata.edited_at ? new Date(data.metadata.edited_at).toLocaleString() : "-"}
              </p>
              <p>
                Deletado:{" "}
                {data.metadata.deleted_at
                  ? new Date(data.metadata.deleted_at).toLocaleString()
                  : "-"}
              </p>
            </section>
            <section>
              <h4>Reacoes</h4>
              {Object.entries(data.reactions).map(([emoji, users]) => (
                <p key={emoji}>
                  {emoji}: {users.map((user) => user.username ?? user.userId).join(", ")}
                </p>
              ))}
            </section>
            <section>
              <h4>Comentarios ({data.comments_count})</h4>
              {data.comments_preview.map((comment) => (
                <p key={comment.id}>{comment.body}</p>
              ))}
            </section>
            <section>
              <h4>Versoes</h4>
              {data.versions.map((version) => (
                <p key={version.id}>
                  {new Date(version.edited_at).toLocaleString()} - {version.body}
                </p>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
