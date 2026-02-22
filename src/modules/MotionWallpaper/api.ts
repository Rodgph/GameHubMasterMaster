import { invoke } from "@tauri-apps/api/core";

export type MotionWallpaperStatus = {
  running: boolean;
  attached: boolean;
  monitors: number;
  videoPath: string | null;
  clickThrough: boolean;
  hostExists: boolean;
  hostReady: boolean;
  hostReadyAt: number | null;
  lastError: string | null;
  hostUrl: string | null;
  parentHwnd: number;
  hostRect: { x: number; y: number; w: number; h: number };
};

export type MotionWallpaperDebugState = {
  hostReady: boolean;
  hostReadyAt: number | null;
  lastVideoEvent: string | null;
  attached: boolean;
  parentHwnd: number;
  hostRect: { x: number; y: number; w: number; h: number };
  lastError: string | null;
  currentVideoPath: string | null;
  hostExists: boolean;
  windows: string[];
};

export async function motionWallpaperStart() {
  return invoke<void>("motion_wallpaper_start");
}

export async function motionWallpaperSetVideo(path: string) {
  return invoke<void>("motion_wallpaper_set_video", { path });
}

export async function motionWallpaperSetVolume(volume: number) {
  return invoke<void>("motion_wallpaper_set_volume", { volume });
}

export async function motionWallpaperApply() {
  return invoke<void>("motion_wallpaper_apply");
}

export async function motionWallpaperStop() {
  return invoke<void>("motion_wallpaper_stop");
}

export async function motionWallpaperStatus() {
  return invoke<MotionWallpaperStatus>("motion_wallpaper_status");
}

export async function motionWallpaperSetClickThrough(enabled: boolean) {
  return invoke<void>("motion_wallpaper_set_click_through", { enabled });
}

export async function motionWallpaperPickVideo() {
  return invoke<string | null>("motion_wallpaper_pick_video");
}

export async function motionWallpaperReloadHost() {
  return invoke<void>("motion_wallpaper_reload_host");
}

export async function motionWallpaperDebugState() {
  return invoke<MotionWallpaperDebugState>("motion_wallpaper_debug_state");
}

export async function motionWallpaperGetMonitors() {
  return invoke<Array<{ id: string; name: string; x: number; y: number; width: number; height: number; primary: boolean }>>(
    "motion_wallpaper_get_monitors",
  );
}

export async function motionWallpaperApplyWithOptions(aspect?: "16:9" | "9:16" | "fill", monitorId?: string) {
  return invoke<void>("motion_wallpaper_apply_ex", { aspect, monitorId, monitor_id: monitorId });
}
