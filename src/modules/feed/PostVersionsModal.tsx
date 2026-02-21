import { useEffect } from "react";
import { useFeedStore } from "./feedStore";

type Props = {
  postId: string;
  onClose: () => void;
};

export function PostVersionsModal({ postId, onClose }: Props) {
  const versions = useFeedStore((state) => state.versionsByPostId[postId] ?? []);
  const loadVersions = useFeedStore((state) => state.loadVersions);

  useEffect(() => {
    void loadVersions(postId);
  }, [loadVersions, postId]);

  return (
    <div className="feed-modal-overlay" data-no-drag="true" onClick={onClose}>
      <div className="feed-modal" data-no-drag="true" onClick={(event) => event.stopPropagation()}>
        <div className="feed-modal-header">
          <strong>Historico de versoes</strong>
          <button data-no-drag="true" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="feed-modal-list">
          {versions.map((version) => (
            <article key={version.id} className="feed-version-item">
              <p>{version.body}</p>
              <span>{new Date(version.edited_at).toLocaleString()}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
