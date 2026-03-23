import { PLAYER_COLORS } from "@/types";

interface PlayerAvatarProps {
  avatarUrl: string | null | undefined;
  displayName: string;
  colorIndex: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-11 h-11 text-base",
  lg: "w-14 h-14 text-xl",
};

export default function PlayerAvatar({
  avatarUrl,
  displayName,
  colorIndex,
  size = "md",
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
        className={`${sizeClass} rounded-full object-cover shrink-0 shadow-lg ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shrink-0 shadow-lg ${className}`}
    >
      <span className="text-white font-bold drop-shadow">{initial}</span>
    </div>
  );
}
