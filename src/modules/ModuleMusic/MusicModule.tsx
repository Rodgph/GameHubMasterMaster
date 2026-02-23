import { MusicModuleLayout } from "./MusicModuleLayout";
import { MusicHomeRoute } from "./routes";
import "./music.css";

export function MusicModule() {
  return (
    <MusicModuleLayout
      header={null}
      renderCompact={() => (
        <div className="music-body-empty" data-no-drag="true">
          <MusicHomeRoute />
        </div>
      )}
      renderWide={() => (
        <div className="music-body-empty" data-no-drag="true">
          <MusicHomeRoute />
        </div>
      )}
    />
  );
}
