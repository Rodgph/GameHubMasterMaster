import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

export function WallpaperHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("[host] mounted");
    console.log("[host] videoRef.current:", videoRef.current);

    const unlisteners: Array<() => void> = [];

    async function setup() {
      console.log("[host] setup() starting");
      const ul1 = await listen<{ path: string }>("mw:set_video", async (event) => {
        console.log("[host] set_video received", event.payload);
        console.log("[host] videoRef.current:", videoRef.current);
        const video = videoRef.current;
        if (!video) {
          console.error("[host] videoRef is null on set_video");
          return;
        }
        console.log("[host] Converting file source...");
        const normalizedPath = event.payload.path.replace(/\\/g, "/");
        console.log("[host] normalizedPath:", normalizedPath);
        const src = convertFileSrc(normalizedPath);
        console.log("[host] convertFileSrc result:", src);

        // Reset video element completely
        console.log("[host] Pausing video...");
        video.pause();
        console.log("[host] Setting currentTime to 0...");
        video.currentTime = 0;
        console.log("[host] Clearing src...");
        video.src = "";
        console.log("[host] Video type:", video.tagName);
        
        // Wait for DOM to reflect changes
        console.log("[host] Waiting 100ms for DOM changes...");
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        // Set new source and wait for it to load
        console.log("[host] Setting src to:", src);
        video.src = src;
        console.log("[host] src attribute set. video.src now:", video.src);
        console.log("[host] video.readyState:", video.readyState);
        
        try {
          // Wait a bit for the browser to start loading
          console.log("[host] Waiting 200ms for browser to start loading...");
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log("[host] About to call play(). video.readyState:", video.readyState);
          const playPromise = video.play();
          if (playPromise !== undefined) {
            console.log("[host] play() returned promise, awaiting...");
            await playPromise;
            console.log("[host] play() success! video.paused:", video.paused);
          } else {
            console.log("[host] play() returned undefined");
          }
        } catch (e) {
          console.error("[host] play() error:", e);
          console.log("[host] Retrying play after 300ms...");
          // Retry play
          await new Promise((resolve) => setTimeout(resolve, 300));
          video.play().catch((retryErr) => console.error("[host] retry play failed:", retryErr));
        }
      });
      unlisteners.push(ul1);

      const ul2 = await listen<{ value: number }>("mw:set_volume", (event) => {
        console.log("[host] set_volume", event.payload.value);
        if (videoRef.current) {
          videoRef.current.volume = event.payload.value;
        }
      });
      unlisteners.push(ul2);

      const ul3 = await listen("mw:play", () => {
        console.log("[host] mw:play");
        videoRef.current?.play().catch(console.error);
      });
      unlisteners.push(ul3);

      const ul4 = await listen("mw:pause", () => {
        console.log("[host] mw:pause");
        videoRef.current?.pause();
      });
      unlisteners.push(ul4);

      const ul5 = await listen("mw:stop", () => {
        console.log("[host] mw:stop");
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = "";
        }
      });
      unlisteners.push(ul5);

      try {
        await invoke("mw_host_ready");
        console.log("[host] ready signaled successfully");
      } catch (e) {
        console.error("[host] failed to signal ready:", e);
      }
      console.log("[host] Listeners setup complete.");

      setTimeout(() => {
        if (videoRef.current && !videoRef.current.src) {
          console.log("[host] no src received yet after 3s - may not have received set_video event");
        }
      }, 3000);
    }

    void setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        overflow: "hidden",
        width: "100vw",
        height: "100vh",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted={true}
        playsInline
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        onLoadedMetadata={() => console.log("[host] video event: LOADEDMETADATA - duration:", videoRef.current?.duration)}
        onLoadedData={() => console.log("[host] video event: LOADEDDATA - readyState:", videoRef.current?.readyState)}
        onCanPlay={() => console.log("[host] video event: CANPLAY")}
        onCanPlayThrough={() => console.log("[host] video event: CANPLAYTHROUGH")}
        onError={() => {
          const error = (videoRef.current as any)?.error;
          console.error("[host] video event: ERROR - code:", error?.code, "message:", error?.message);
        }}
        onPlay={() => console.log("[host] video event: PLAYING")}
        onPause={() => console.log("[host] video event: PAUSED")}
        onTimeUpdate={() => console.log("[host] video event: TIMEUPDATE - currentTime:", videoRef.current?.currentTime.toFixed(2))}
      />
    </div>
  );
}
