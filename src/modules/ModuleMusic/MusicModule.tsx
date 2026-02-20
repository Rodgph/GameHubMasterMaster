export function MusicModule() {
  return (
    <section className="module-body">
      <h3>Music Placeholder</h3>
      <label htmlFor="volume">Volume</label>
      <input id="volume" type="range" min={0} max={100} defaultValue={40} />
      <textarea rows={4} placeholder="Textarea para validar foco e digitacao." />
    </section>
  );
}
