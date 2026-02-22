import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MwStatus } from "../types";

export function MotionWallpaperControl() {
  const [videoPath, setVideoPath] = useState("");
  const [volume, setVolume] = useState(0.5);
  const [clickThrough, setClickThrough] = useState(false);
  const [status, setStatus] = useState<MwStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastUiError, setLastUiError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const statusText = useMemo(() => JSON.stringify(status, null, 2), [status]);

  const refreshStatus = async () => {
    const data = await invoke<MwStatus>("mw_status");
    setStatus(data);
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: number | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
        }),
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const run = async (label: string, task: () => Promise<unknown>) => {
    setBusy(true);
    setBusyAction(label);
    setLastUiError(null);
    try {
      await withTimeout(task(), 12000, label);
    } catch (error) {
      setLastUiError(String(error));
    } finally {
      try {
        await withTimeout(refreshStatus(), 4000, "mw_status");
      } catch (error) {
        setLastUiError((prev) => prev ?? String(error));
      } finally {
        setBusy(false);
        setBusyAction(null);
      }
    }
  };

  return (
    <main className="control-page">
      <h1>Motion Wallpaper Lab</h1>
      <div className="row">
        <button
          disabled={busy}
          onClick={() =>
            run("mw_pick_video", async () => {
              const picked = await invoke<string | null>("mw_pick_video");
              if (picked) setVideoPath(picked);
            })
          }
        >
          Escolher video
        </button>
        <input value={videoPath} onChange={(e) => setVideoPath(e.target.value)} placeholder="Caminho do video" />
      </div>

      <div className="row">
        <button disabled={busy} onClick={() => run("mw_start_host", () => invoke("mw_start_host"))}>
          Start Host
        </button>
        <button
          disabled={busy || !videoPath}
          onClick={() => run("mw_apply", () => invoke("mw_apply", { path: videoPath, volume, clickThrough }))}
        >
          Aplicar
        </button>
        <button disabled={busy} onClick={() => run("mw_stop", () => invoke("mw_stop"))}>
          Parar
        </button>
        <button disabled={busy} onClick={() => run("mw_reload_host", () => invoke("mw_reload_host"))}>
          Recarregar Host
        </button>
      </div>

      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={clickThrough}
            onChange={(e) => {
              const enabled = e.target.checked;
              setClickThrough(enabled);
              void run("mw_set_click_through", () => invoke("mw_set_click_through", { enabled }));
            }}
          />
          Click-through
        </label>
        <label>
          Volume {volume.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              const next = Number(e.target.value);
              setVolume(next);
              void run("mw_set_volume", () => invoke("mw_set_volume", { value: next }));
            }}
          />
        </label>
      </div>

      <section className="debug-panel">
        <h2>Debug</h2>
        <button disabled={busy} onClick={() => void run("mw_status", refreshStatus)}>
          Atualizar Status
        </button>
        {busyAction && <p>Executando: {busyAction}</p>}
        {lastUiError && <p>{lastUiError}</p>}
        <pre>{statusText}</pre>
      </section>
    </main>
  );
}
