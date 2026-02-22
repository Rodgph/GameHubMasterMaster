import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./wallpaperHost.css";

export function WallpaperHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("[host] mounted");
    const unlisteners: Array<() => void> = [];

    async function setup() {
      const ul1 = await listen<{ path: string }>("motion-wallpaper:set-video", async (event) => {
        const video = videoRef.current;
        if (!video) return;

        const normalizedPath = event.payload.path.replace(/\\/g, "/");
        const src = convertFileSrc(normalizedPath);

        video.pause();
        video.removeAttribute("src");
        video.load();
        await new Promise((resolve) => setTimeout(resolve, 50));

        video.src = src;
        video.load();
        try {
          await video.play();
        } catch (e) {
          console.error("[host] play() error:", e);
        }
      });
      unlisteners.push(ul1);

      const ul2 = await listen<{ volume: number }>("motion-wallpaper:set-volume", (event) => {
        if (videoRef.current) {
          videoRef.current.volume = Math.max(0, Math.min(1, event.payload.volume / 100));
        }
      });
      unlisteners.push(ul2);

      const ul3 = await listen("motion-wallpaper:play", () => {
        videoRef.current?.play().catch(console.error);
      });
      unlisteners.push(ul3);

      const ul4 = await listen("motion-wallpaper:pause", () => {
        videoRef.current?.pause();
      });
      unlisteners.push(ul4);

      const ul5 = await listen("motion-wallpaper:stop", () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        }
      });
      unlisteners.push(ul5);

      await invoke("motion_wallpaper_host_ready");
      console.log("[host] ready signaled");
    }

    void setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="wallpaper-host-root">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted={true}
        playsInline
        className="wallpaper-host-video"
        onLoadedData={() => console.log("[host] loadeddata")}
        onCanPlay={() => console.log("[host] canplay")}
        onError={(e) => console.error("[host] error", e)}
      />
    </div>
  );
}
