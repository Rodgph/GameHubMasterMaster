import { FeedHeader } from "./FeedHeader";
import "./feed.css";

export function FeedModule() {
  return (
    <section className="feed-module module-body" data-no-drag="true">
      <FeedHeader />
      <section className="feed-home-content" data-no-drag="true">
        <p className="feed-home-empty">Header da home criado. Corpo do feed pode ser ligado aqui.</p>
      </section>
    </section>
  );
}
