import { invoke } from "@tauri-apps/api/core";

export async function openWidgetWindow(label: string, widgetId: string, moduleId: string) {
  return invoke("open_widget_window", { label, widgetId, moduleId });
}

export async function closeWindow(label: string) {
  return invoke("close_window", { label });
}
