import type { ComponentType } from "react";

export type ModuleMode = "dock" | "widget";
export type ModuleId = "chat" | "feed" | "music" | "motion_wallpaper" | "welcome";
export type WidgetHost = "dom" | "tauri";

export type ModuleConstraints = {
  minWidth: number;
  minHeight?: number;
  height?: "100%";
};

export type RegisteredModule = {
  id: ModuleId;
  title: string;
  component: ComponentType;
  dockConstraints: ModuleConstraints;
  widgetConstraints: ModuleConstraints;
};
