// src/hooks/useAdhanAutoScheduler.ts
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

import {
  loadAdhanSettings,
  getPendingNotifications,
  scheduleAdhanForNextDays,
} from "@/adhan/adhanNotifications";

const LAST_SCHEDULED_KEY = "adhan_last_scheduled_day";

function todayKey() {
  const d = new Date();
  // local day key (not UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Keeps Adhan scheduled without user opening Settings.
 * Strategy:
 * - schedule N days ahead
 * - re-check on app launch + resume
 * - avoid repeated reschedules using a day marker
 */
export function useAdhanAutoScheduler(daysAhead = 7) {
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    const run = async () => {
      try {
        if (Capacitor.getPlatform() === "web") return;

        const s = loadAdhanSettings();
        if (!s.enabled) return;

        const marker = todayKey();
        const last = localStorage.getItem(LAST_SCHEDULED_KEY);

        // Check pending notifications
        const pending = await getPendingNotifications();
        const pendingCount = pending?.notifications?.length ?? 0;

        // Rebuild schedule when:
        // - first time today, OR
        // - notifications look low (user rebooted, OS cleared, timezone change, etc.)
        const shouldReschedule = last !== marker || pendingCount < 3;

        if (!shouldReschedule) return;

        await scheduleAdhanForNextDays(daysAhead, s);
        localStorage.setItem(LAST_SCHEDULED_KEY, marker);
      } catch (e) {
        console.warn("[useAdhanAutoScheduler] failed:", e);
      }
    };

    // Run once on mount
    void run();

    // Run when app resumes
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void run();
    }).then((h) => {
      removeListener = () => h.remove();
    });

    return () => {
      removeListener?.();
    };
  }, [daysAhead]);
}