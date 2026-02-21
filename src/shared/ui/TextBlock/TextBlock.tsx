import "./TextBlock.css";

type TextBlockProps = {
  title: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function TextBlock({
  title,
  subtitle,
  titleClassName = "",
  subtitleClassName = "",
}: TextBlockProps) {
  const mergedTitleClassName = ["text-block-title", titleClassName].filter(Boolean).join(" ");
  const mergedSubtitleClassName = ["text-block-subtitle", subtitleClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="text-block" data-no-drag="true">
      <h4 className={mergedTitleClassName}>{title}</h4>
      {subtitle ? <p className={mergedSubtitleClassName}>{subtitle}</p> : null}
    </div>
  );
}
