import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MwStatus } from "../types";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout apos ${ms}ms`)), ms)),
  ]);
}

async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>, timeoutMs = 10000): Promise<T> {
  return withTimeout(invoke<T>(cmd, args), timeoutMs);
}

export function MotionWallpaperControl() {
  const [videoPath, setVideoPath] = useState("");
  const [volume, setVolume] = useState(0.5);
  const [clickThrough, setClickThrough] = useState(false);
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");
  const [monitors, setMonitors] = useState<Array<{ id: number; name: string; rect: { x: number; y: number; w: number; h: number } }>>([]);
  const [monitorId, setMonitorId] = useState<number | null>(null);
  const [status, setStatus] = useState<MwStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string>("none");
  const [lastError, setLastError] = useState<string>("");

  const statusText = useMemo(() => JSON.stringify(status, null, 2), [status]);

  async function refreshStatus(): Promise<void> {
    const next = await invokeSafe<MwStatus>("mw_status");
    setStatus(next);
  }

  async function run(label: string, fn: () => Promise<void>, timeoutMs = 10000) {
    setBusy(true);
    setLastAction(label);
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

  useEffect(() => {
    void run("startup_host", async () => {
      await invokeSafe("mw_start_host", undefined, 15000);
      await refreshStatus();
    }, 20000);
    void (async () => {
      try {
        const mons = await invokeSafe<Array<any>>("mw_get_monitors");
        setMonitors(mons || []);
        if (mons && mons.length > 0) setMonitorId(mons[0].id);
      } catch (e) {
        console.warn("failed to get monitors", e);
      }
    })();
  }, []);

  return (
    <main className="control-page">
      <h1>Motion Wallpaper Lab</h1>

      <div className="row">
        <button
          disabled={busy}
          onClick={() =>
            void run("mw_pick_video", async () => {
              const picked = await invokeSafe<string | null>("mw_pick_video");
              if (picked) {
                setVideoPath(picked);
                // apply immediately on select
                if (picked) {
                  await invokeSafe("mw_start_host", undefined, 15000);
                  await invokeSafe(
                    "mw_apply",
                    { path: picked, volume, clickThrough, aspect, monitor: monitorId },
                    20000,
                  );
                }
              }
            })
          }
        >
          Escolher video
        </button>
        <input
          value={videoPath}
          onChange={(e) => setVideoPath(e.target.value)}
          placeholder="Caminho do video"
        />
      </div>

      <div className="row">
        <button disabled={busy} onClick={() => void run("mw_start_host", async () => invokeSafe("mw_start_host"))}>
          Start Host
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Aspecto:
          <select value={aspect} onChange={(e) => setAspect(e.target.value as any)}>
            <option value="16:9">16:9 (landscape)</option>
            <option value="9:16">9:16 (portrait)</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Monitor:
          <select value={monitorId ?? ""} onChange={(e) => setMonitorId(Number(e.target.value))}>
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || `Monitor ${m.id}`} ({m.rect.w}x{m.rect.h})
              </option>
            ))}
          </select>
        </label>

        <button
          disabled={busy || !videoPath}
          onClick={() =>
            void run(
              "mw_apply",
              async () => {
                await invokeSafe("mw_start_host", undefined, 15000);
                await invokeSafe(
                  "mw_apply",
                  { path: videoPath, volume, clickThrough, aspect, monitor: monitorId },
                  20000,
                );
              },
              20000,
            )
          }
        >
          Aplicar
        </button>
        <button disabled={busy} onClick={() => void run("mw_stop", async () => invokeSafe("mw_stop"))}>
          Parar
        </button>
        <button
          disabled={busy}
          onClick={() => void run("mw_reload_host", async () => invokeSafe("mw_reload_host"))}
        >
          Recarregar Host
        </button>
        <button
          disabled={busy || !videoPath}
          onClick={() =>
            void run("mw_force_reattach", async () =>
              invokeSafe("mw_apply", { path: videoPath, volume, clickThrough, aspect }),
            )
          }
        >
          Forcar Reattach
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
              void run("mw_set_click_through", async () =>
                invokeSafe("mw_set_click_through", { enabled }),
              );
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
              void run("mw_set_volume", async () => invokeSafe("mw_set_volume", { value: next }));
            }}
          />
        </label>
      </div>

      <section className="debug-panel">
        <h2>Debug</h2>
        <button disabled={busy} onClick={() => void run("mw_status", async () => refreshStatus())}>
          Atualizar Status
        </button>
        <p>lastAction: {lastAction}</p>
        <p>lastError: {lastError || "none"}</p>
        <pre>{statusText}</pre>
      </section>
    </main>
  );
}
