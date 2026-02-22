import { invoke } from "@tauri-apps/api/core";

export type MonitorDesc = {
  id: number;
  name: string;
  rect: { x: number; y: number; w: number; h: number };
  primary: boolean;
};

export async function pickVideo() {
  return invoke<string | null>("motion_wallpaper_pick_video");
}

export async function startHost() {
  return invoke<void>("motion_wallpaper_start");
}

export async function reloadHost() {
  return invoke<void>("motion_wallpaper_reload_host");
}

export async function stopWallpaper() {
  return invoke<void>("motion_wallpaper_stop");
}

export async function setClickThrough(enabled: boolean) {
  return invoke<void>("motion_wallpaper_set_click_through", { enabled });
}

export async function setVolume(volume01: number) {
  const volume = Math.round(Math.max(0, Math.min(1, volume01)) * 100);
  return invoke<void>("motion_wallpaper_set_volume", { volume });
}

export async function setVideo(path: string) {
  return invoke<void>("motion_wallpaper_set_video", { path });
}

export async function status() {
  return invoke<Record<string, unknown>>("motion_wallpaper_status");
}

export async function debugState() {
  return invoke<Record<string, unknown>>("motion_wallpaper_debug_state");
}

export async function getMonitors() {
  return invoke<MonitorDesc[]>("motion_wallpaper_get_monitors");
}

export async function applyEx(args: {
  path: string;
  volume: number;
  clickThrough: boolean;
  aspect: "fill" | "16:9" | "9:16";
  monitorId?: number;
}) {
  await startHost();
  await setVideo(args.path);
  await setVolume(args.volume);
  await setClickThrough(args.clickThrough);

  const mappedAspect = args.aspect === "fill" ? "16:9" : args.aspect;
  return invoke<void>("motion_wallpaper_apply_ex", {
    aspect: mappedAspect,
    monitor: args.monitorId,
  });
}
