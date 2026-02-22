import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyEx,
  debugState,
  getMonitors,
  pickVideo,
  reloadHost,
  setClickThrough,
  setVolume,
  startHost,
  status,
  stopWallpaper,
  type MonitorDesc,
} from "./api";
import "./motionWallpaper.css";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout apos ${ms}ms`)), ms)),
  ]);
}

export function MotionWallpaperModule() {
  const [videoPath, setVideoPath] = useState("");
  const [volume, setVolumeState] = useState(0.5);
  const [clickThrough, setClickThroughState] = useState(false);
  const [aspect, setAspect] = useState<"fill" | "16:9" | "9:16">("fill");
  const [monitors, setMonitors] = useState<MonitorDesc[]>([]);
  const [monitorId, setMonitorId] = useState<number | null>(null);
  const [statusState, setStatusState] = useState<Record<string, unknown> | null>(null);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string>("none");
  const [lastError, setLastError] = useState<string>("");
  const autoApplyRef = useRef<number | null>(null);

  const statusText = useMemo(
    () => JSON.stringify({ status: statusState, debug }, null, 2),
    [statusState, debug],
  );

  async function refreshStatus(): Promise<void> {
    const [s, d] = await Promise.all([withTimeout(status(), 4000), withTimeout(debugState(), 4000)]);
    setStatusState(s);
    setDebug(d);
  }

  async function run(label: string, fn: () => Promise<void>, timeoutMs = 10000) {
    setBusy(true);
    setLastAction(label);
    setLastError("");
    try {
      await withTimeout(fn(), timeoutMs);
      await withTimeout(refreshStatus(), 4000);
    } catch (e: unknown) {
      setLastError(String((e as { message?: string })?.message ?? e));
      try {
        await withTimeout(refreshStatus(), 4000);
      } catch {
        // noop
      }
    } finally {
      setBusy(false);
    }
  }

  async function applyCurrent() {
    if (!videoPath) return;
    await applyEx({
      path: videoPath,
      volume,
      clickThrough,
      aspect,
      monitorId: monitorId ?? undefined,
    });
  }

  useEffect(() => {
    void run(
      "startup_host",
      async () => {
        await withTimeout(startHost(), 15000);
        const mons = await withTimeout(getMonitors(), 6000);
        setMonitors(mons || []);
        if (mons.length > 0) {
          setMonitorId((mons.find((m) => m.primary) ?? mons[0]).id);
        }
      },
      20000,
    );

    return () => {
      if (autoApplyRef.current !== null) {
        clearTimeout(autoApplyRef.current);
      }
    };
  }, []);

  return (
    <section className="module-body motion-wallpaper" data-no-drag="true">
      <h3>Motion Wallpaper</h3>

      <div className="module-item">
        <button
          disabled={busy}
          onClick={() =>
            void run("motion_wallpaper_pick_video", async () => {
              const picked = await withTimeout(pickVideo(), 10000);
              if (!picked) return;
              setVideoPath(picked);
              if (autoApplyRef.current !== null) {
                clearTimeout(autoApplyRef.current);
              }
              autoApplyRef.current = window.setTimeout(() => {
                void run("auto_apply", async () => applyCurrent(), 20000);
              }, 200);
            })
          }
        >
          Escolher video
        </button>
        <span>{videoPath || "Caminho do video"}</span>
      </div>

      <div className="module-item">
        <button disabled={busy} onClick={() => void run("motion_wallpaper_start", async () => startHost())}>
          Start Host
        </button>
        <button disabled={busy || !videoPath} onClick={() => void run("motion_wallpaper_apply_ex", async () => applyCurrent(), 20000)}>
          Aplicar
        </button>
        <button disabled={busy} onClick={() => void run("motion_wallpaper_stop", async () => stopWallpaper())}>
          Parar
        </button>
        <button disabled={busy} onClick={() => void run("motion_wallpaper_reload_host", async () => reloadHost())}>
          Recarregar Host
        </button>
      </div>

      <label className="module-item motion-row">
        <span>Aspecto do video</span>
        <select value={aspect} onChange={(e) => setAspect(e.target.value as "fill" | "16:9" | "9:16")}>
          <option value="fill">fill</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </label>

      <label className="module-item motion-row">
        <span>Monitor</span>
        <select value={monitorId ?? ""} onChange={(e) => setMonitorId(Number(e.target.value))}>
          {monitors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.primary ? "[Primario] " : ""}
              {m.name} ({m.rect.w}x{m.rect.h} @ {m.rect.x},{m.rect.y})
            </option>
          ))}
        </select>
      </label>

      <label className="module-item motion-row">
        <span>Modo Click-through (nao capturar clique)</span>
        <input
          type="checkbox"
          checked={clickThrough}
          onChange={(e) => {
            const enabled = e.target.checked;
            setClickThroughState(enabled);
            void run("motion_wallpaper_set_click_through", async () => setClickThrough(enabled));
          }}
        />
      </label>

      <label className="module-item">
        <span>Volume ({volume.toFixed(2)})</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => {
            const next = Number(e.target.value);
            setVolumeState(next);
            void run("motion_wallpaper_set_volume", async () => setVolume(next));
          }}
        />
      </label>

      <div className="module-item">
        <strong>Debug</strong>
        <span>lastAction: {lastAction}</span>
        <span>lastError: {lastError || "none"}</span>
      </div>

      <div className="module-item">
        <button disabled={busy} onClick={() => void run("motion_wallpaper_status", async () => refreshStatus())}>
          Atualizar Status
        </button>
      </div>

      <pre>{statusText}</pre>
    </section>
  );
}
