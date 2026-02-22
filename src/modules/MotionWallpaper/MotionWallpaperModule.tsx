import { useEffect, useMemo, useState } from "react";
import { isTauri } from "../../core/platform/isTauri";
import {
  motionWallpaperApply,
  motionWallpaperDebugState,
  motionWallpaperPickVideo,
  motionWallpaperReloadHost,
  motionWallpaperSetClickThrough,
  motionWallpaperSetVideo,
  motionWallpaperSetVolume,
  motionWallpaperStart,
  motionWallpaperStatus,
  motionWallpaperStop,
  type MotionWallpaperDebugState,
  type MotionWallpaperStatus,
} from "./api";
import {
  loadMotionWallpaperConfig,
  saveMotionWallpaperConfig,
  type MotionWallpaperConfig,
} from "./storage";
import "./motionWallpaper.css";

type UiStatus = MotionWallpaperStatus & {
  state: "parado" | "rodando";
};

const EMPTY_DEBUG: MotionWallpaperDebugState = {
  hostReady: false,
  lastHostReadyAt: null,
  lastVideoEvent: null,
  attached: false,
  parentHwnd: 0,
  hostRect: { x: 0, y: 0, w: 0, h: 0 },
  lastError: null,
  currentVideoPath: null,
  hostExists: false,
  windows: [],
};

function toUiStatus(status: MotionWallpaperStatus): UiStatus {
  return {
    ...status,
    state: status.running ? "rodando" : "parado",
  };
}

function formatTs(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function MotionWallpaperModule() {
  const [config, setConfig] = useState<MotionWallpaperConfig>(() => loadMotionWallpaperConfig());
  const [status, setStatus] = useState<UiStatus>({
    running: false,
    attached: false,
    monitors: 1,
    videoPath: null,
    clickThrough: true,
    hostExists: false,
    hostReady: false,
    hostReadyAt: null,
    lastError: null,
    hostUrl: null,
    state: "parado",
  });
  const [debugState, setDebugState] = useState<MotionWallpaperDebugState>(EMPTY_DEBUG);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState("");
  const [actionError, setActionError] = useState("");
  const disabled = busy || !isTauri;

  useEffect(() => {
    saveMotionWallpaperConfig(config);
  }, [config]);

  useEffect(() => {
    if (!isTauri) return;
    let active = true;

    const refresh = async () => {
      try {
        const [nextStatus, nextDebug] = await Promise.all([
          motionWallpaperStatus(),
          motionWallpaperDebugState(),
        ]);
        if (!active) return;
        setStatus(toUiStatus(nextStatus));
        setDebugState(nextDebug);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao ler motion_wallpaper_debug_state";
        setActionError(message);
      }
    };

    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const fileName = useMemo(() => {
    if (!config.videoPath) return "Nenhum video selecionado";
    const normalized = config.videoPath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || config.videoPath;
  }, [config.videoPath]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      if (isTauri) {
        const [nextStatus, nextDebug] = await Promise.all([
          motionWallpaperStatus(),
          motionWallpaperDebugState(),
        ]);
        setStatus(toUiStatus(nextStatus));
        setDebugState(nextDebug);
      }
    } finally {
      setBusy(false);
    }
  };

  const onApply = async () => {
    if (!config.videoPath) return;
    try {
      setActionError("");
      await withBusy(async () => {
        await motionWallpaperStart();
        const started = await motionWallpaperStatus();
        if (!started.hostExists) {
          throw new Error("Host nao foi criado");
        }
        await motionWallpaperSetVideo(config.videoPath);
        await motionWallpaperSetVolume(config.volume);
        await motionWallpaperSetClickThrough(config.clickThrough);
        await motionWallpaperApply();
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Falha ao aplicar wallpaper.";
      setActionError(message);
    }
  };

  const onStop = async () => {
    await withBusy(async () => {
      await motionWallpaperStop();
    });
  };

  const onPickVideo = async () => {
    if (!isTauri) return;
    try {
      setPickError("");
      const selected = await motionWallpaperPickVideo();
      if (!selected) return;
      setConfig((prev) => ({ ...prev, videoPath: selected }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Falha ao abrir seletor de video.";
      setPickError(message);
    }
  };

  const onReloadHost = async () => {
    try {
      setActionError("");
      await withBusy(async () => {
        await motionWallpaperReloadHost();
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Falha ao recarregar host.";
      setActionError(message);
    }
  };

  return (
    <section className="module-body motion-wallpaper" data-no-drag="true">
      <h3>Motion Wallpaper</h3>

      <div className="module-item">
        <button type="button" onClick={() => void onPickVideo()} disabled={disabled}>
          Escolher video
        </button>
        <span>{fileName}</span>
      </div>

      <div className="module-item">
        <button type="button" onClick={() => void onApply()} disabled={disabled || !config.videoPath}>
          Aplicar
        </button>
        <button type="button" onClick={() => void onStop()} disabled={disabled}>
          Parar
        </button>
        <button type="button" onClick={() => void onReloadHost()} disabled={disabled}>
          Recarregar Host
        </button>
      </div>

      <label className="module-item motion-row" htmlFor="mw-click-through">
        <span>Modo Click-through (nao capturar clique)</span>
        <input
          id="mw-click-through"
          type="checkbox"
          checked={config.clickThrough}
          onChange={(event) => {
            const next = event.target.checked;
            setConfig((prev) => ({ ...prev, clickThrough: next }));
            if (isTauri) {
              void motionWallpaperSetClickThrough(next).then(async () => {
                const s = await motionWallpaperStatus();
                setStatus(toUiStatus(s));
              });
            }
          }}
          disabled={disabled}
        />
      </label>

      <label className="module-item" htmlFor="mw-volume">
        <span>Volume ({config.volume})</span>
        <input
          id="mw-volume"
          type="range"
          min={0}
          max={100}
          value={config.volume}
          onChange={(event) => {
            const volume = Number(event.target.value);
            setConfig((prev) => ({ ...prev, volume }));
            if (isTauri) {
              void motionWallpaperSetVolume(volume);
            }
          }}
          disabled={disabled}
        />
      </label>

      <label className="module-item motion-row" htmlFor="mw-autostart">
        <span>Iniciar com o Windows</span>
        <input
          id="mw-autostart"
          type="checkbox"
          checked={config.startWithWindows}
          onChange={(event) =>
            setConfig((prev) => ({ ...prev, startWithWindows: event.target.checked }))
          }
        />
      </label>

      <div className="module-item">
        <strong>Status: {status.state}</strong>
        <span>Attached: {status.attached ? "sim" : "nao"}</span>
        <span>Monitores: {status.monitors}</span>
      </div>

      <div className="module-item">
        <strong>Debug</strong>
        <span>Host: {debugState.hostReady ? "pronto" : "nao pronto"}</span>
        <span>HostExists: {debugState.hostExists ? "sim" : "nao"}</span>
        <span>HostReadyAt: {formatTs(debugState.lastHostReadyAt)}</span>
        <span>VideoEvent: {debugState.lastVideoEvent ?? "-"}</span>
        <span>Attached: {debugState.attached ? "sim" : "nao"}</span>
        <span>
          Rect: {debugState.hostRect.x},{debugState.hostRect.y},{debugState.hostRect.w},{debugState.hostRect.h}
        </span>
        <span>Parent HWND: {debugState.parentHwnd}</span>
        <span>Windows: {debugState.windows.join(", ") || "-"}</span>
        <span>Ultimo erro: {debugState.lastError ?? "-"}</span>
      </div>

      {!isTauri ? <p>Disponivel apenas no desktop (Tauri/Windows).</p> : null}
      {pickError ? <p>{pickError}</p> : null}
      {actionError ? <p>{actionError}</p> : null}
    </section>
  );
}
