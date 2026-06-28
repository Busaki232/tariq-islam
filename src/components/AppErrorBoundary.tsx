// src/components/AppErrorBoundary.tsx
import React from "react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackPath?: string },
  { hasError: boolean; error?: any }
> {
  state = { hasError: false as boolean, error: undefined as any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any) {
    console.error("[UI Crash]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg =
      String(this.state.error?.message ?? this.state.error ?? "Unknown error");

    return (
      <div className="p-6">
        <div className="text-lg font-semibold">Something went wrong</div>
        <div className="mt-2 text-sm text-muted-foreground break-words">
          {msg}
        </div>
        <button
          className="mt-4 underline"
          onClick={() => {
            window.location.href = this.props.fallbackPath ?? "/messages";
          }}
        >

          Back to Messages
        </button>
      </div>
    );
  }
}