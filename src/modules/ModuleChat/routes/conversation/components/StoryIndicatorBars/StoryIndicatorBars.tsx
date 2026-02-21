import type { CSSProperties } from "react";
import "./StoryIndicatorBars.css";

type StoryIndicatorBarsProps = {
  count: number;
  activeIndex?: number;
  activeProgress?: number;
};

export function StoryIndicatorBars({
  count,
  activeIndex = 0,
  activeProgress = 0,
}: StoryIndicatorBarsProps) {
  const bars = Array.from({ length: Math.max(1, count) }, (_, index) => index);
  const progress = `${Math.max(0, Math.min(1, activeProgress)) * 100}%`;

  return (
    <div className="story-indicator-bars" data-no-drag="true">
      {bars.map((index) => (
        <span
          key={index}
          className={`story-indicator-bar ${index < activeIndex ? "filled" : ""} ${
            index === activeIndex ? "active" : ""
          }`}
          style={index === activeIndex ? ({ "--story-progress": progress } as CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}
