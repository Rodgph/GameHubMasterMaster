export type MwStatus = {
  host_exists: boolean;
  host_ready_at: string | null;
  attached: boolean;
  parent_hwnd: number | null;
  host_hwnd: number | null;
  rect: { x: number; y: number; w: number; h: number };
  last_error: string | null;
  video_path: string | null;
};
