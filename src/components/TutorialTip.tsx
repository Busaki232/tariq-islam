// src/components/TutorialTip.tsx
import { ReactNode } from "react";

type TutorialTipProps = {
  storageKey: string;
  children: ReactNode;
};

export default function TutorialTip({ storageKey, children }: TutorialTipProps) {
  if (typeof window === "undefined") return null;

  const seen = localStorage.getItem(storageKey) === "true";
  if (seen) return null;

  return (
    <div className="rounded-xl border bg-muted p-4 text-sm">
      <div className="mb-2">{children}</div>

      <button
        className="text-xs underline text-muted-foreground"
        onClick={() => localStorage.setItem(storageKey, "true")}
        type="button"
      >
        Got it
      </button>
    </div>
  );
}