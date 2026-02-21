import "./DaySeparator.css";

type DaySeparatorProps = {
  label: string;
};

export function DaySeparator({ label }: DaySeparatorProps) {
  return (
    <div className="day-separator" data-no-drag="true">
      <span className="day-separator-label">{label}</span>
    </div>
  );
}
