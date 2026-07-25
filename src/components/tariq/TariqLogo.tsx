import { cn } from "@/lib/utils";

type TariqLogoProps = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  opacity?: number;
  className?: string;
  showName?: boolean;
  alt?: string;
};

const sizeClasses = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

export default function TariqLogo({
  size = "md",
  opacity = 1,
  className,
  showName = false,
  alt = "Tariq Islam",
}: TariqLogoProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      style={{ opacity }}
    >
      <img
        src="/tariq-logo.png"
        alt={alt}
        className={cn(
          sizeClasses[size],
          "shrink-0 object-contain"
        )}
      />

      {showName && (
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
          Tariq Islam
        </span>
      )}
    </div>
  );
}
