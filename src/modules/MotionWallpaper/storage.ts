export type MotionWallpaperConfig = {
  videoPath: string;
  volume: number;
  clickThrough: boolean;
  startWithWindows: boolean;
};

const KEY = "motion_wallpaper_config_v1";

const DEFAULT_CONFIG: MotionWallpaperConfig = {
  videoPath: "",
  volume: 50,
  clickThrough: true,
  startWithWindows: false,
};

export function loadMotionWallpaperConfig(): MotionWallpaperConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<MotionWallpaperConfig>;
    return {
      videoPath: typeof parsed.videoPath === "string" ? parsed.videoPath : "",
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.max(0, Math.min(100, Math.round(parsed.volume)))
          : 50,
      clickThrough: parsed.clickThrough ?? true,
      startWithWindows: parsed.startWithWindows ?? false,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveMotionWallpaperConfig(config: MotionWallpaperConfig) {
  localStorage.setItem(KEY, JSON.stringify(config));
}
