import { isTauri } from "./isTauri";

export type UnlistenFn = () => void;

export async function tauriListen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return () => {};

  const mod = await import("@tauri-apps/api/event");
  const unlisten = await mod.listen<T>(event, (payloadEvent) => handler(payloadEvent.payload));
  return unlisten;
}

export async function tauriEmit<T>(event: string, payload: T): Promise<void> {
  if (!isTauri) return;

  const mod = await import("@tauri-apps/api/event");
  await mod.emit(event, payload);
}
