import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./ChatModuleLayout.css";

type ChatModuleLayoutProps = {
  header?: ReactNode;
  renderCompact: () => ReactNode;
  renderWide: () => ReactNode;
};

export function ChatModuleLayout({ header, renderCompact, renderWide }: ChatModuleLayoutProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(target);
    setContainerWidth(target.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const compactMode = useMemo(() => containerWidth > 0 && containerWidth < 400, [containerWidth]);

  return (
    <section
      className={`chat-module-layout ${compactMode ? "compact" : "wide"}`}
      ref={containerRef}
      data-chat-compact={compactMode ? "true" : "false"}
      data-no-drag="true"
    >
      {header}
      <div className="chat-module-layout-body" data-no-drag="true">
        {compactMode ? renderCompact() : renderWide()}
      </div>
    </section>
  );
}
