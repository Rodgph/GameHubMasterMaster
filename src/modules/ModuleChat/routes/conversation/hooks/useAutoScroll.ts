import { useEffect, type RefObject } from "react";
import type { Message } from "../types/message";

export function useAutoScroll(containerRef: RefObject<HTMLElement | null>, messages: Message[]) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldStickToBottom = distanceFromBottom < 40;
    if (!shouldStickToBottom) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
  }, [containerRef, messages]);
}
