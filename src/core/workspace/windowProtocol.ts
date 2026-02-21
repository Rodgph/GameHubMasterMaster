import type { ModuleId } from "../modules/types";

export const WINDOW_EVENTS = {
  widgetReady: "mm:widget_ready",
  hydrateWidget: "mm:hydrate_widget",
  widgetClosed: "mm:widget_closed",
  reattachWidget: "mm:reattach_widget",
} as const;

export type WidgetReadyPayload = {
  widgetId: string;
};

export type HydrateWidgetPayload = {
  widgetId: string;
  moduleId: ModuleId;
  state: unknown;
  version: 1;
};

export type WidgetClosedPayload = {
  widgetId: string;
};

export type ReattachWidgetPayload = {
  widgetId: string;
};
