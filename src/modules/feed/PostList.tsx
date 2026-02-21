import { useMemo } from "react";
import { useFeedStore } from "./feedStore";
import { PostCard } from "./PostCard";

export function PostList() {
  const posts = useFeedStore((state) => state.posts);
  const wsStatus = useFeedStore((state) => state.wsStatus);
  const loadPosts = useFeedStore((state) => state.loadPosts);
  const userFilterId = useFeedStore((state) => state.userFilterId);
  const setUserFilterId = useFeedStore((state) => state.setUserFilterId);
  const filteredPosts = useMemo(
    () => (userFilterId ? posts.filter((post) => post.user_id === userFilterId) : posts),
    [posts, userFilterId],
  );

  if (filteredPosts.length === 0) {
    return <p className="feed-empty">Nenhum post ainda.</p>;
  }

  return (
    <div className="feed-list" data-no-drag="true">
      <div className="feed-list-header">
        <span>Status: {wsStatus}</span>
        {userFilterId ? (
          <button data-no-drag="true" type="button" onClick={() => setUserFilterId(null)}>
            Ver todos os posts
          </button>
        ) : null}
      </div>
      {filteredPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <button
        data-no-drag="true"
        className="feed-load-more"
        type="button"
        onClick={() => void loadPosts(filteredPosts[filteredPosts.length - 1]?.created_at)}
      >
        Carregar mais
      </button>
    </div>
  );
}
