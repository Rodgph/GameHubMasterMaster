import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { tauriEmit, tauriListen } from "../../core/platform/tauriEvents";
import "./wallpaperHost.css";

type SetVideoPayload = { path: string };
type SetVolumePayload = { volume: number };

type VideoEventPayload = {
  type: "loadeddata" | "playing" | "error";
  code?: number;
  message?: string;
};

function toFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  if (normalized.startsWith("//")) {
    return encodeURI(`file:${normalized}`);
  }
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(`file://${normalized}`);
}

function toPlayableSrc(path: string): string {
  try {
    return convertFileSrc(path);
  } catch {
    return toFileUrl(path);
  }
}

export function WallpaperHostPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void invoke("motion_wallpaper_host_ready")
      .then(() => {
        console.info("[host] mounted/ready");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setError(`HOST READY ERROR: ${message}`);
      });

    let unlistenSetVideo: (() => void) | null = null;
    let unlistenSetVolume: (() => void) | null = null;
    let unlistenPlay: (() => void) | null = null;
    let unlistenPause: (() => void) | null = null;
    let unlistenStop: (() => void) | null = null;
    let unlistenPing: (() => void) | null = null;

    void tauriListen<SetVideoPayload>("motion-wallpaper:set-video", ({ path }) => {
      const el = videoRef.current;
      if (!el) return;
      setError("");
      el.src = toPlayableSrc(path);
      el.load();
      console.info("[wallpaper-host] set-video", { path, src: el.src });
      void el.play().catch((err) => {
        const message = err instanceof Error ? err.message : "play failed";
        setError(`VIDEO ERROR ${message}`);
        void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
          type: "error",
          message,
        });
      });
    }).then((u) => (unlistenSetVideo = u));

    void tauriListen<SetVolumePayload>("motion-wallpaper:set-volume", ({ volume }) => {
      const el = videoRef.current;
      if (!el) return;
      el.volume = Math.max(0, Math.min(1, volume / 100));
    }).then((u) => (unlistenSetVolume = u));

    void tauriListen<void>("motion-wallpaper:play", () => {
      void videoRef.current?.play();
    }).then((u) => (unlistenPlay = u));

    void tauriListen<void>("motion-wallpaper:pause", () => {
      videoRef.current?.pause();
    }).then((u) => (unlistenPause = u));

    void tauriListen<void>("motion-wallpaper:stop", () => {
      const el = videoRef.current;
      if (!el) return;
      el.pause();
      el.currentTime = 0;
    }).then((u) => (unlistenStop = u));

    void tauriListen<void>("motion-wallpaper:ping", () => {
      void tauriEmit("motion_wallpaper:pong", { ts: Date.now() });
    }).then((u) => (unlistenPing = u));

    return () => {
      unlistenSetVideo?.();
      unlistenSetVolume?.();
      unlistenPlay?.();
      unlistenPause?.();
      unlistenStop?.();
      unlistenPing?.();
    };
  }, []);

  return (
    <main className="wallpaper-host-root">
      <video
        ref={videoRef}
        className="wallpaper-host-video"
        autoPlay
        loop
        controls={false}
        preload="auto"
        onLoadedData={() => {
          setError("");
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "loadeddata",
          });
        }}
        onPlaying={() => {
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "playing",
          });
        }}
        onError={() => {
          const el = videoRef.current;
          const code = el?.error?.code;
          const message = code ? `code=${code}` : "unknown";
          setError(`VIDEO ERROR ${message}`);
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "error",
            code,
            message,
          });
        }}
      />
      <div className="wallpaper-host-ready">WALLPAPER HOST ATIVO</div>
      {error ? <div className="wallpaper-host-error">{error}</div> : null}
    </main>
  );
}
