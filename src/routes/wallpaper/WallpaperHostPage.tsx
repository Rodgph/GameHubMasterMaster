import { useEffect, useRef } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { tauriEmit, tauriListen } from "../../core/platform/tauriEvents";
import "./wallpaperHost.css";

type SetVideoPayload = { path: string };
type SetVolumePayload = { volume: number };

type VideoEventPayload = {
  type: "loadeddata" | "playing" | "error";
  code?: number;
  message?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function WallpaperHostPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    console.log("[host] mounted");
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const ul1 = await tauriListen<SetVideoPayload>("motion-wallpaper:set-video", async ({ path }) => {
        const video = videoRef.current;
        if (!video) {
          console.error("[host] videoRef null on set-video");
          return;
        }

        const normalizedPath = path.replace(/\\/g, "/");
        const src = convertFileSrc(normalizedPath);
        console.log("[host] set_video", { path: normalizedPath, src });

        video.pause();
        video.removeAttribute("src");
        video.load();
        await sleep(50);

        video.src = src;
        video.load();
        try {
          await video.play();
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error("[host] play error", msg);
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "error",
            message: msg,
          });
        }
      });
      unlisteners.push(ul1);

      const ul2 = await tauriListen<SetVolumePayload>("motion-wallpaper:set-volume", ({ volume }) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = Math.max(0, Math.min(1, volume / 100));
        console.log("[host] set_volume", video.volume);
      });
      unlisteners.push(ul2);

      const ul3 = await tauriListen<void>("motion-wallpaper:play", () => {
        console.log("[host] play");
        void videoRef.current?.play();
      });
      unlisteners.push(ul3);

      const ul4 = await tauriListen<void>("motion-wallpaper:pause", () => {
        console.log("[host] pause");
        videoRef.current?.pause();
      });
      unlisteners.push(ul4);

      const ul5 = await tauriListen<void>("motion-wallpaper:stop", () => {
        console.log("[host] stop");
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      unlisteners.push(ul5);

      await invoke("motion_wallpaper_host_ready");
      console.log("[host] ready signaled");
    };

    void setup();

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);

  return (
    <main className="wallpaper-host-root">
      <video
        ref={videoRef}
        className="wallpaper-host-video"
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        preload="auto"
        onLoadedData={() => {
          console.log("[host] loadeddata");
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "loadeddata",
          });
        }}
        onCanPlay={() => {
          console.log("[host] canplay");
        }}
        onPlaying={() => {
          console.log("[host] playing");
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "playing",
          });
        }}
        onError={() => {
          const el = videoRef.current;
          const code = el?.error?.code;
          const message = code ? `code=${code}` : "unknown";
          console.error("[host] error", message);
          void tauriEmit<VideoEventPayload>("motion_wallpaper:video_event", {
            type: "error",
            code,
            message,
          });
        }}
      />
    </main>
  );
}
