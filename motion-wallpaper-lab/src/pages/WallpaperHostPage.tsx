import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

type SetVideoPayload = { path: string };
type SetVolumePayload = { value: number };

export function WallpaperHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("[host] mounted");
    void invoke("mw_host_ready");

    const unlistenPromises = [
      listen<SetVideoPayload>("mw:set_video", async (event) => {
        const video = videoRef.current;
        if (!video) return;
        console.log("[host] set_video", event.payload.path);
        video.src = convertFileSrc(event.payload.path);
        video.load();
      }),
      listen<SetVolumePayload>("mw:set_volume", (event) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = Math.max(0, Math.min(1, event.payload.value));
      }),
      listen("mw:play", async () => {
        const video = videoRef.current;
        if (!video) return;
        await video.play();
      }),
      listen("mw:pause", () => {
        videoRef.current?.pause();
      }),
      listen("mw:stop", () => {
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        video.currentTime = 0;
      }),
    ];

    return () => {
      void Promise.all(unlistenPromises).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  return (
    <div className="host-page">
      <video
        ref={videoRef}
        className="host-video"
        autoPlay
        loop
        muted={false}
        controls={false}
        playsInline
        onLoadedData={() => console.log("[host] loadeddata")}
        onCanPlay={() => console.log("[host] canplay")}
        onError={(event) => console.error("[host] error", event)}
      />
    </div>
  );
}
