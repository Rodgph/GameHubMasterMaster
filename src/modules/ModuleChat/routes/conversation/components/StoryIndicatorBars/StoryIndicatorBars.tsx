import "./StoryIndicatorBars.css";

type StoryIndicatorBarsProps = {
  count: number;
  activeIndex?: number;
};

export function StoryIndicatorBars({ count, activeIndex = 0 }: StoryIndicatorBarsProps) {
  const bars = Array.from({ length: Math.max(1, count) }, (_, index) => index);

  return (
    <div className="story-indicator-bars" data-no-drag="true">
      {bars.map((index) => (
        <span
          key={index}
          className={`story-indicator-bar ${index === activeIndex ? "active" : ""}`}
        />
      ))}
    </div>
  );
}
