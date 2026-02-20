export function FeedModule() {
  return (
    <section className="module-body">
      <h3>Feed Placeholder</h3>
      <div data-scroll-region="true" className="module-scroll">
        {Array.from({ length: 20 }).map((_, index) => (
          <p key={index} className="module-item">
            Item de feed #{index + 1}
          </p>
        ))}
      </div>
      <a href="https://example.com" target="_blank" rel="noreferrer">
        Link de teste
      </a>
    </section>
  );
}
