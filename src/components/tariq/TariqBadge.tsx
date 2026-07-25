import {
  BookOpen,
  Building2,
  Crown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TariqLogo from "@/components/tariq/TariqLogo";

type TariqBadgeVariant =
  | "creator"
  | "verified-creator"
  | "scholar"
  | "mosque"
  | "moderator"
  | "admin";

type TariqBadgeSize = "sm" | "md";

interface TariqBadgeProps {
  variant: TariqBadgeVariant;
  size?: TariqBadgeSize;
  className?: string;
  showLabel?: boolean;
}

const badgeConfig = {
  creator: {
    label: "Creator",
    icon: Sparkles,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  "verified-creator": {
    label: "Verified Creator",
    icon: null,
    className:
      "border-emerald-300 bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-900 dark:border-emerald-700 dark:from-emerald-950/70 dark:to-amber-950/40 dark:text-emerald-100",
  },
  scholar: {
    label: "Scholar",
    icon: BookOpen,
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  },
  mosque: {
    label: "Verified Mosque",
    icon: Building2,
    className:
      "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-200",
  },
  moderator: {
    label: "Moderator",
    icon: ShieldCheck,
    className:
      "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200",
  },
  admin: {
    label: "Administrator",
    icon: Crown,
    className:
      "border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-950 dark:border-amber-600 dark:from-amber-950/60 dark:to-yellow-950/40 dark:text-amber-100",
  },
} as const;

const sizeClasses = {
  sm: {
    wrapper: "gap-1 px-1.5 py-0.5 text-[10px]",
    icon: "h-3 w-3",
    logoSize: "xs" as const,
  },
  md: {
    wrapper: "gap-1.5 px-2 py-1 text-xs",
    icon: "h-3.5 w-3.5",
    logoSize: "xs" as const,
  },
};

export default function TariqBadge({
  variant,
  size = "sm",
  className,
  showLabel = true,
}: TariqBadgeProps) {
  const config = badgeConfig[variant];
  const sizing = sizeClasses[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full border font-semibold leading-none shadow-sm",
        sizing.wrapper,
        config.className,
        className
      )}
      title={config.label}
      aria-label={config.label}
    >
      {variant === "verified-creator" ? (
        <TariqLogo
          size={sizing.logoSize}
          opacity={1}
          className="shrink-0"
        />
      ) : (
        Icon && <Icon className={sizing.icon} />
      )}

      {showLabel && <span>{config.label}</span>}
    </span>
  );
}