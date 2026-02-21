import type { FeedPost } from "./feedStore";
import { useSessionStore } from "../../core/stores/sessionStore";
import { useFeedStore } from "./feedStore";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;

type Props = {
  post: FeedPost;
  onClose: () => void;
};

export function ReactionPicker({ post, onClose }: Props) {
  const addReaction = useFeedStore((state) => state.addReaction);
  const removeReaction = useFeedStore((state) => state.removeReaction);
  const me = useSessionStore((state) => state.user?.id ?? "");

  return (
    <div className="feed-reaction-picker" data-no-drag="true">
      {EMOJIS.map((emoji) => {
        const hasMine = (post.reactions[emoji] ?? []).some((user) => user.userId === me);
        return (
          <button
            key={emoji}
            data-no-drag="true"
            type="button"
            onClick={() =>
              void (hasMine ? removeReaction(post.id, emoji) : addReaction(post.id, emoji))
            }
          >
            {emoji}
          </button>
        );
      })}
      <button data-no-drag="true" type="button" onClick={onClose}>
        Fechar
      </button>
    </div>
  );
}
