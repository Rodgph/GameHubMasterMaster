import { useEffect } from "react";
import { FeedHeader } from "./FeedHeader";
import { PostList } from "./PostList";
import { useFeedStore } from "./feedStore";
import { PostDataModal } from "./PostDataModal";
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
    <section className="feed-module module-body">
      <FeedHeader />
      <PostList />
      {activePostId ? <PostDataModal postId={activePostId} /> : null}
    </section>
  );
}
