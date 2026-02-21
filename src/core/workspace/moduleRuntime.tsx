import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const WidgetRuntimeContext = createContext<string | null>(null);

export function WidgetRuntimeProvider({
  widgetId,
  children,
}: {
  widgetId: string;
  children: ReactNode;
}) {
  return <WidgetRuntimeContext.Provider value={widgetId}>{children}</WidgetRuntimeContext.Provider>;
}

export function useCurrentWidgetId() {
  return useContext(WidgetRuntimeContext);
}
