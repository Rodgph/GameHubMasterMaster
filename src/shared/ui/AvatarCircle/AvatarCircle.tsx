import "./AvatarCircle.css";

type AvatarCircleProps = {
  src?: string;
  alt: string;
  size?: number;
};

export function AvatarCircle({ src, alt, size = 60 }: AvatarCircleProps) {
  return (
    <div className="avatar-circle" style={{ width: size, height: size }} data-no-drag="true">
      {src ? <img src={src} alt={alt} className="avatar-circle-image" draggable={false} /> : null}
    </div>
  );
}
