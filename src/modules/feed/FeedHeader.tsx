import { PostComposer } from "./PostComposer";

export function FeedHeader() {
  return (
    <header className="feed-header" data-no-drag="true">
      <PostComposer />
    </header>
  );
}
