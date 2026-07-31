import {
  BookOpen,
  Building2,
  CalendarCheck,
  Flame,
  Heart,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import founderBadgeImage from "@/assets/tariq-founder-badge.jpeg";
import { cn } from "@/lib/utils";

export type UserAchievementBadgeData = {
  awardId: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  colorScheme: string;
  category: string;
  awardedAt: string;
  reason: string | null;
  sortOrder: number;
};

type Props = {
  badge: UserAchievementBadgeData;
  iconOnly?: boolean;
  className?: string;
};

const icons = {
  sparkles: Sparkles,
  "calendar-check": CalendarCheck,
  flame: Flame,
  "book-open": BookOpen,
  users: Users,
  building: Building2,
  heart: Heart,
  trophy: Trophy,
} as const;

const colors: Record<string, string> = {
  emerald:
    "border-emerald-400 bg-emerald-950 text-emerald-200",
  green:
    "border-green-400 bg-green-950 text-green-200",
  amber:
    "border-amber-400 bg-amber-950 text-amber-200",
  blue:
    "border-blue-400 bg-blue-950 text-blue-200",
  purple:
    "border-purple-400 bg-purple-950 text-purple-200",
  teal:
    "border-teal-400 bg-teal-950 text-teal-200",
  rose:
    "border-rose-400 bg-rose-950 text-rose-200",
  gold:
    "border-amber-400 bg-gradient-to-r from-amber-950 to-yellow-900 text-amber-200",
  "gold-blue":
    "border-amber-400 bg-blue-950 text-amber-200",
};

export default function UserAchievementBadge({
  badge,
  iconOnly = false,
  className,
}: Props) {
  const Icon =
    icons[badge.iconKey as keyof typeof icons] ??
    Sparkles;

  const title = badge.reason
    ? `${badge.name}: ${badge.reason}`
    : `${badge.name}: ${badge.description}`;

  if (iconOnly) {
    return (
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg",
          colors[badge.colorScheme] ??
            colors.green,
          className
        )}
        title={title}
        aria-label={title}
      >
        {badge.iconKey === "founder" ? (
          <img
            src={founderBadgeImage}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm",
        colors[badge.colorScheme] ??
          colors.green,
        className
      )}
      title={title}
      aria-label={title}
    >
      {badge.iconKey === "founder" ? (
        <img
          src={founderBadgeImage}
          alt=""
          aria-hidden="true"
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <Icon className="h-4 w-4" />
      )}

      <span>{badge.name}</span>
    </span>
  );
}
