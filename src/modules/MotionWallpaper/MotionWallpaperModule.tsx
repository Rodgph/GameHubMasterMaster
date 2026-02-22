import { useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "../../core/platform/isTauri";
import {
  motionWallpaperApply,
  motionWallpaperApplyWithOptions,
  motionWallpaperDebugState,
  motionWallpaperGetMonitors,
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

type AspectOption = "16:9" | "9:16" | "fill";
type MonitorItem = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
};

type UiStatus = MotionWallpaperStatus & {
  state: "parado" | "rodando";
};

const EMPTY_DEBUG: MotionWallpaperDebugState = {
  hostReady: false,
  hostReadyAt: null,
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = window.setTimeout(() => {
        reject(new Error(`Timeout apos ${ms}ms`));
      }, ms);
      void id;
    }),
  ]);
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
    parentHwnd: 0,
    hostRect: { x: 0, y: 0, w: 0, h: 0 },
    state: "parado",
  });
  const [debugState, setDebugState] = useState<MotionWallpaperDebugState>(EMPTY_DEBUG);
  const [monitorsList, setMonitorsList] = useState<MonitorItem[]>([]);
  const [monitorId, setMonitorId] = useState<string>("");
  const [aspect, setAspect] = useState<AspectOption>("fill");
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState("");
  const [actionError, setActionError] = useState("");
  const autoApplyTimerRef = useRef<number | null>(null);
  const disabled = busy || !isTauri;

  useEffect(() => {
    saveMotionWallpaperConfig(config);
  }, [config]);

  const refreshStatus = async () => {
    if (!isTauri) return;
    const [nextStatus, nextDebug] = await Promise.all([
      motionWallpaperStatus(),
      motionWallpaperDebugState(),
    ]);
    setStatus(toUiStatus(nextStatus));
    setDebugState(nextDebug);
  };

  const run = async (label: string, fn: () => Promise<void>, timeoutMs = 10000) => {
    setBusy(true);
    setActionError("");
    try {
      await withTimeout(fn(), timeoutMs);
      await withTimeout(refreshStatus(), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(`${label}: ${message}`);
      try {
        await withTimeout(refreshStatus(), 4000);
      } catch {
        // ignore refresh errors after action failure
      }
    } finally {
      setBusy(false);
    }
  };

  const applyCurrent = async () => {
    if (!config.videoPath) return;
    await motionWallpaperStart();
    await motionWallpaperSetVideo(config.videoPath);
    await motionWallpaperSetVolume(config.volume);
    await motionWallpaperSetClickThrough(config.clickThrough);
    try {
      await motionWallpaperApplyWithOptions(aspect, monitorId || undefined);
    } catch {
      await motionWallpaperApply();
    }
  };

  useEffect(() => {
    if (!isTauri) return;
    let active = true;

    const init = async () => {
      try {
        await withTimeout(motionWallpaperStart(), 10000);
        const mons = await withTimeout(motionWallpaperGetMonitors(), 6000);
        if (!active) return;
        setMonitorsList(mons);
        const primary = mons.find((m) => m.primary) ?? mons[0];
        if (primary) {
          setMonitorId(primary.id);
        }
        await withTimeout(refreshStatus(), 4000);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        setActionError(`init: ${message}`);
      }
    };

    void init();
    const id = window.setInterval(() => {
      void refreshStatus().catch(() => {
        // periodic best effort
      });
    }, 1200);

    return () => {
      active = false;
      window.clearInterval(id);
      if (autoApplyTimerRef.current !== null) {
        window.clearTimeout(autoApplyTimerRef.current);
      }
    };
  }, []);

  const fileName = useMemo(() => {
    if (!config.videoPath) return "Nenhum video selecionado";
    const normalized = config.videoPath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || config.videoPath;
  }, [config.videoPath]);

  const onApply = async () => {
    await run("mw_apply", applyCurrent, 20000);
  };

  const onStop = async () => {
    await run("mw_stop", motionWallpaperStop);
  };

  const onPickVideo = async () => {
    if (!isTauri) return;
    try {
      setPickError("");
      const selected = await withTimeout(motionWallpaperPickVideo(), 10000);
      if (!selected) return;
      setConfig((prev) => ({ ...prev, videoPath: selected }));

      if (autoApplyTimerRef.current !== null) {
        window.clearTimeout(autoApplyTimerRef.current);
      }
      autoApplyTimerRef.current = window.setTimeout(() => {
        void run("auto_apply", async () => {
          await motionWallpaperSetVideo(selected);
          await motionWallpaperSetVolume(config.volume);
          await motionWallpaperSetClickThrough(config.clickThrough);
          try {
            await motionWallpaperApplyWithOptions(aspect, monitorId || undefined);
          } catch {
            await motionWallpaperApply();
          }
        }, 20000);
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPickError(message);
    }
  };

  const onReloadHost = async () => {
    await run("mw_reload_host", motionWallpaperReloadHost);
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

      <label className="module-item motion-row" htmlFor="mw-aspect">
        <span>Aspecto do video</span>
        <select
          id="mw-aspect"
          value={aspect}
          onChange={(e) => setAspect(e.target.value as AspectOption)}
          disabled={disabled}
        >
          <option value="fill">fill</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </label>

      {monitorsList.length > 0 && (
        <label className="module-item motion-row" htmlFor="mw-monitor">
          <span>Monitor</span>
          <select
            id="mw-monitor"
            value={monitorId}
            onChange={(e) => setMonitorId(e.target.value)}
            disabled={disabled}
          >
            {monitorsList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.primary ? "[Primario] " : ""}
                {m.name || m.id} ({m.width}x{m.height} @ {m.x},{m.y})
              </option>
            ))}
          </select>
        </label>
      )}

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
              void run("mw_set_click_through", async () => {
                await motionWallpaperSetClickThrough(next);
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
        <span>Host: {status.hostReady ? "pronto" : "nao pronto"}</span>
        <span>HostExists: {status.hostExists ? "sim" : "nao"}</span>
        <span>HostReadyAt: {formatTs(status.hostReadyAt)}</span>
        <span>VideoEvent: {debugState.lastVideoEvent ?? "-"}</span>
        <span>Attached: {status.attached ? "sim" : "nao"}</span>
        <span>
          Rect: {status.hostRect.x},{status.hostRect.y},{status.hostRect.w},{status.hostRect.h}
        </span>
        <span>Parent HWND: {status.parentHwnd}</span>
        <span>Windows: {debugState.windows.join(", ") || "-"}</span>
        <span>Host URL: {status.hostUrl ?? "-"}</span>
        <span>Ultimo erro: {status.lastError ?? debugState.lastError ?? "-"}</span>
      </div>

      {!isTauri ? <p>Disponivel apenas no desktop (Tauri/Windows).</p> : null}
      {pickError ? <p>{pickError}</p> : null}
      {actionError ? <p className="motion-wallpaper-error">{actionError}</p> : null}
    </section>
  );
}
