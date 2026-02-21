import "./MessageMeta.css";

type MessageMetaProps = {
  time: string;
};

export function MessageMeta({ time }: MessageMetaProps) {
  return (
    <span className="message-meta" data-no-drag="true">
      {time}
    </span>
  );
}
