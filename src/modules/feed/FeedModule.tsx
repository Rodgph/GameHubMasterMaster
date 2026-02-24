import { useEffect } from "react";
import { useFeedStore } from "./feedStore";
import { FeedHeader } from "./FeedHeader";
import { PostDataModal } from "./PostDataModal";
import { PostList } from "./PostList";
import "./feed.css";

export function FeedModule() {
  const loadPosts = useFeedStore((state) => state.loadPosts);
  const connectWs = useFeedStore((state) => state.connectWs);
  const disconnectWs = useFeedStore((state) => state.disconnectWs);
  const activePostId = useFeedStore((state) => state.activePostId);

  useEffect(() => {
    void loadPosts();
    void connectWs();
    return () => {
      disconnectWs();
    };
  }, [connectWs, disconnectWs, loadPosts]);

  return (
    <section className="feed-module module-body" data-no-drag="true">
      <FeedHeader />
      <section className="feed-home-content" data-no-drag="true">
        <PostList />
      </section>
      {activePostId ? <PostDataModal postId={activePostId} /> : null}
    </section>
  );
}
