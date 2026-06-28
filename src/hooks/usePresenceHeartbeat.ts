import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function getPlatform(): string {
  try {
    return Capacitor.getPlatform(); // "web" | "android" | "ios"
  } catch {
    return "web";
  }
}

export function usePresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let stopped = false;
    let intervalId: any = null;

    const ping = async () => {
      if (stopped) return;
      await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          last_seen: new Date().toISOString(),
          platform: getPlatform(),
          status: "online",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    };

    // First ping immediately
    void ping();

    // Heartbeat every 25s (online threshold 60s)
    intervalId = setInterval(() => void ping(), 25000);

    // Web: ping when tab becomes active
    const onVisibility = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Native: ping on resume
    let resumeHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      resumeHandle = CapApp.addListener("resume", () => void ping());
    }

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      if (resumeHandle) resumeHandle.remove();
    };
  }, [user?.id]);
}