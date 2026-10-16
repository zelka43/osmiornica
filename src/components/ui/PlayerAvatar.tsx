import { PLAYER_COLORS } from "@/types";

interface PlayerAvatarProps {
  avatarUrl: string | null | undefined;
  displayName: string;
  colorIndex: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-11 h-11 text-base",
  lg: "w-14 h-14 text-xl",
  xl: "w-24 h-24 text-3xl",
};

export default function PlayerAvatar({
  avatarUrl,
  displayName,
  colorIndex,
  size = "md" as "sm" | "md" | "lg" | "xl",
  className = "",
}: PlayerAvatarProps) {
  const sizeClass = SIZES[size];
  const colorClass = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  const initial = displayName.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full ${colorClass} flex items-center justify-center shrink-0 ${className}`}
    >
      <span className="text-white font-bold">{initial}</span>
    </div>
  );
}
