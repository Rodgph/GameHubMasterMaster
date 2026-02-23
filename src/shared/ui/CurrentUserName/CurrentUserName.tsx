import { useSessionStore } from "../../../core/stores/sessionStore";

type CurrentUserNameProps = {
  className?: string;
  fallback?: string;
  prefix?: string;
  suffix?: string;
};

export function CurrentUserName({
  className,
  fallback = "user",
  prefix = "",
  suffix = "",
}: CurrentUserNameProps) {
  const currentName = useSessionStore((state) => {
    const displayName = state.user?.display_name?.trim();
    if (displayName) return displayName;
    const username = state.user?.username?.trim();
    if (username) return username;
    return fallback;
  });

  return <span className={className}>{`${prefix}${currentName}${suffix}`}</span>;
}
