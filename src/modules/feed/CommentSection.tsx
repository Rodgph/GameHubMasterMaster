import { useEffect, useState } from "react";
import { useFeedStore } from "./feedStore";

type Props = {
  postId: string;
};

export function CommentSection({ postId }: Props) {
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const comments = useFeedStore((state) => state.commentsByPostId[postId] ?? []);
  const loadComments = useFeedStore((state) => state.loadComments);
  const addComment = useFeedStore((state) => state.addComment);
  const deleteComment = useFeedStore((state) => state.deleteComment);

  useEffect(() => {
    void loadComments(postId);
  }, [loadComments, postId]);

  const byParent = new Map<string | null, typeof comments>();
  for (const comment of comments) {
    const key = comment.parent_comment_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(comment);
    byParent.set(key, list);
  }

  function renderComments(parentId: string | null, depth: 0 | 1 | 2) {
    const list = byParent.get(parentId) ?? [];
    return list.map((comment) => (
      <div
        key={comment.id}
        className="feed-comment-item"
        style={{ marginLeft: `${depth * 16}px` }}
        data-no-drag="true"
      >
        {comment.deleted_at ? (
          <p>Comentario removido.</p>
        ) : (
          <>
            <p>
              <strong>{comment.username ?? comment.user_id}</strong>: {comment.body}
            </p>
            <div className="feed-comment-actions">
              <button data-no-drag="true" type="button" onClick={() => setReplyTo(comment.id)}>
                Responder
              </button>
              <button
                data-no-drag="true"
                type="button"
                onClick={() => void deleteComment(comment.id)}
              >
                Remover
              </button>
            </div>
          </>
        )}
        {depth < 2 ? renderComments(comment.id, (depth + 1) as 1 | 2) : null}
      </div>
    ));
  }

  return (
    <div className="feed-comments">
      <div className="feed-comments-list">{renderComments(null, 0)}</div>
      <div className="feed-comments-actions">
        <input
          data-no-drag="true"
          value={commentBody}
          placeholder={replyTo ? "Responder..." : "Comentar..."}
          onChange={(event) => setCommentBody(event.target.value)}
        />
        <button
          data-no-drag="true"
          type="button"
          onClick={() => {
            const text = commentBody.trim();
            if (!text) return;
            void addComment(postId, text, replyTo);
            setCommentBody("");
            setReplyTo(null);
          }}
        >
          Enviar
        </button>
        {replyTo ? (
          <button data-no-drag="true" type="button" onClick={() => setReplyTo(null)}>
            Cancelar reply
          </button>
        ) : null}
      </div>
    </div>
  );
}
