import { useState } from "react";
import type { FeedPost } from "./feedStore";
import { useFeedStore } from "./feedStore";
import { CommentSection } from "./CommentSection";
import { ReactionPicker } from "./ReactionPicker";
import { PostVersionsModal } from "./PostVersionsModal";

type Props = {
  post: FeedPost;
};

export function PostCard({ post }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const liked = post.user_has_liked;
  const likePost = useFeedStore((state) => state.likePost);
  const unlikePost = useFeedStore((state) => state.unlikePost);
  const deletePost = useFeedStore((state) => state.deletePost);
  const editPost = useFeedStore((state) => state.editPost);
  const setActivePostId = useFeedStore((state) => state.setActivePostId);
  const setUserFilterId = useFeedStore((state) => state.setUserFilterId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);

  if (post.deleted_at) {
    return <article className="feed-post-card">Post removido.</article>;
  }

  return (
    <article className="feed-post-card">
      <div className="feed-post-header">
        <button
          data-no-drag="true"
          type="button"
          className="feed-user-button"
          onClick={() => setUserFilterId(post.user_id)}
        >
          {post.username ?? post.user_id}
        </button>
        <p className="feed-post-meta">{new Date(post.created_at).toLocaleString()}</p>
      </div>
      {isEditing ? (
        <div className="feed-edit-row">
          <textarea
            data-no-drag="true"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
          />
          <button
            data-no-drag="true"
            type="button"
            onClick={() => {
              const body = draft.trim();
              if (!body) return;
              void editPost(post.id, body);
              setIsEditing(false);
            }}
          >
            Salvar
          </button>
        </div>
      ) : (
        <p className="feed-post-body">{post.body}</p>
      )}
      {post.image_url ? (
        <img className="feed-post-image" src={post.image_url} alt="imagem do post" />
      ) : null}
      <div className="feed-post-actions">
        <button
          data-no-drag="true"
          type="button"
          className={liked ? "feed-like-button active" : "feed-like-button"}
          onClick={() => void (liked ? unlikePost(post.id) : likePost(post.id))}
        >
          Curtir ({post.likes_count})
        </button>
        <button
          data-no-drag="true"
          type="button"
          onClick={() => setShowComments((value) => !value)}
        >
          Comentarios ({post.comments_count})
        </button>
        <button
          data-no-drag="true"
          type="button"
          onClick={() => setShowReactions((value) => !value)}
        >
          Reagir
        </button>
        <button data-no-drag="true" type="button" onClick={() => setIsEditing((value) => !value)}>
          Editar
        </button>
        <button data-no-drag="true" type="button" onClick={() => setActivePostId(post.id)}>
          ...
        </button>
        <button data-no-drag="true" type="button" onClick={() => void deletePost(post.id)}>
          Remover
        </button>
      </div>
      <div className="feed-reactions-row">
        {Object.entries(post.reactions).map(([emoji, users]) => (
          <span key={emoji} className="feed-reaction-pill">
            {emoji} {users.length}
          </span>
        ))}
      </div>
      {post.edited_at ? (
        <p className="feed-edited">
          editado{" "}
          <button data-no-drag="true" type="button" onClick={() => setShowVersions(true)}>
            ver versoes
          </button>
        </p>
      ) : null}
      {showReactions ? (
        <ReactionPicker post={post} onClose={() => setShowReactions(false)} />
      ) : null}
      {showComments ? <CommentSection postId={post.id} /> : null}
      {showVersions ? (
        <PostVersionsModal postId={post.id} onClose={() => setShowVersions(false)} />
      ) : null}
    </article>
  );
}
