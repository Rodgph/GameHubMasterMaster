import { useState } from "react";
import { BaseIconButton } from "../../shared/ui";
import {
  BsSkipBackwardFill,
  BsSkipForwardFill,
  FaPause,
  FaPlay,
  FaRegHeart,
  FiMoreHorizontal,
  FiRepeat,
} from "../../shared/ui/icons";
import "./ModuleFooter.css";

export function ModuleFooter() {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  if (controlsOpen) {
    return (
      <footer className="music-footer" data-no-drag="true">
        <div className="music-footer-content" data-no-drag="true">
          <div className="music-footer-row music-footer-row-controls" data-no-drag="true">
            <div className="music-footer-controls-center" data-no-drag="true">
              <BaseIconButton className="music-footer-control-btn" ariaLabel="Curtir musica">
                <FaRegHeart size={20} />
              </BaseIconButton>

              <BaseIconButton className="music-footer-control-btn" ariaLabel="Voltar musica">
                <BsSkipBackwardFill size={20} />
              </BaseIconButton>

              <BaseIconButton
                className="music-footer-control-btn"
                ariaLabel={playing ? "Pausar musica" : "Reproduzir musica"}
                onClick={() => setPlaying((prev) => !prev)}
              >
                {playing ? <FaPause size={40} /> : <FaPlay size={40} />}
              </BaseIconButton>

              <BaseIconButton className="music-footer-control-btn" ariaLabel="Avancar musica">
                <BsSkipForwardFill size={20} />
              </BaseIconButton>

              <BaseIconButton className="music-footer-control-btn" ariaLabel="Repetir musica">
                <FiRepeat size={20} />
              </BaseIconButton>
            </div>

            <button
              type="button"
              className="music-footer-more-btn is-open"
              aria-label="Fechar controles"
              data-no-drag="true"
              onClick={() => setControlsOpen(false)}
            >
              <FiMoreHorizontal size={20} />
            </button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="music-footer" data-no-drag="true">
      <div className="music-footer-content" data-no-drag="true">
        <div className="music-footer-row music-footer-row-main" data-no-drag="true">
          <div className="music-footer-album-cover" data-no-drag="true">
            <BaseIconButton className="music-footer-play-btn" ariaLabel="Reproduzir faixa">
              <FaPlay size={12} />
            </BaseIconButton>
          </div>

          <div className="music-footer-meta" data-no-drag="true">
            <p className="music-footer-title">kunk de 50</p>
            <div className="music-footer-artists" data-no-drag="true">
              <button type="button" className="music-footer-artist-btn" data-no-drag="true">
                Bullet
              </button>
              <span className="music-footer-artist-sep">,</span>
              <button type="button" className="music-footer-artist-btn" data-no-drag="true">
                Thoney
              </button>
              <span className="music-footer-artist-sep">,</span>
              <button type="button" className="music-footer-artist-btn" data-no-drag="true">
                BlakkClout
              </button>
            </div>
          </div>

          <button
            type="button"
            className="music-footer-more-btn"
            aria-label="Mais opcoes"
            data-no-drag="true"
            onClick={() => setControlsOpen(true)}
          >
            <FiMoreHorizontal size={20} />
          </button>
        </div>

        <div className="music-footer-row music-footer-row-timeline" data-no-drag="true">
          <div className="music-footer-timeline" aria-hidden="true">
            <div className="music-footer-timeline-current" />
          </div>
        </div>
      </div>
    </footer>
  );
}
