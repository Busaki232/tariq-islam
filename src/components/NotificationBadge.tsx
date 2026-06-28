import { Badge } from "@/components/ui/badge";

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export const NotificationBadge = ({ count, className = "" }: NotificationBadgeProps) => {
  if (count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className={`h-5 min-w-5 flex items-center justify-center p-1 text-xs ${className}`}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
};
