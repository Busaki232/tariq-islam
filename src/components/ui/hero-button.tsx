import * as React from "react";
import { cn } from "@/lib/utils";

export interface HeroButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg" | "xl";
}

export const HeroButton = React.forwardRef<
  HTMLButtonElement,
  HeroButtonProps
>(function HeroButton(
  { className, variant = "default", size = "md", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2",
        variant === "outline" && "border border-white/40 text-white hover:bg-white/10",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "default" && "bg-islamic-green text-white hover:bg-islamic-green/90",
        !variant && "bg-islamic-green text-white hover:bg-islamic-green/90",
        size === "xl" && "h-14 px-8 text-lg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});