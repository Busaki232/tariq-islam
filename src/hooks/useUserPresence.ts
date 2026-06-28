// src/hooks/useUserPresence.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Capacitor } from "@capacitor/core";

const ONLINE_HIDE_KEY = "ti_hide_online_status";

// How long since last_seen counts as "online"
const ONLINE_WINDOW_MS = 75_000; // 75s feels good for mobile
// How often we heartbeat last_seen while app is open
const HEARTBEAT_MS = 25_000;

type PresenceRow = {
  user_id: string;
  last_seen: string | null;
  platform: string | null;
  // optional, only if you add it to DB later
  hide_status?: boolean | null;
};

export type PresenceInfo = {
  is_online: boolean;
  last_seen: string | null;
  platform: string | null;
  hide_status?: boolean;
};

type ReturnShape = {
  presenceMap: Record<string, PresenceInfo>;
  hideOnline: boolean; // local-only (current device)
  setHideOnline: React.Dispatch<React.SetStateAction<boolean>>;
};

function getBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function setBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function platformName(): string {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios" || p === "web") return p;
    return "web";
  } catch {
    return "web";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isOnlineFromLastSeen(lastSeenIso: string | null) {
  if (!lastSeenIso) return false;
  const t = Date.parse(lastSeenIso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= ONLINE_WINDOW_MS;
}

/**
 * Presence hook (works with your CURRENT table):
 * public.user_presence columns: user_id, last_seen, platform
 *
 * It will:
 * - heartbeat update current user's last_seen while app is open
 * - read last_seen for visible user ids
 * - compute online/offline as "seen recently"
 *
 * Hide toggle is localStorage ONLY (works immediately without DB schema changes).
 * If you later add hide_status to DB, this hook will try to read/write it but will not crash if missing.
 */
export function useUserPresence(visibleUserIds: string[]): ReturnShape {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // local-only setting for this device
  const [hideOnline, setHideOnline] = useState<boolean>(() => getBool(ONLINE_HIDE_KEY, false));

  useEffect(() => {
    setBool(ONLINE_HIDE_KEY, hideOnline);
  }, [hideOnline]);

  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceInfo>>({});

  const visibleIdsKey = useMemo(() => {
    // stable key, prevents effect spam
    const uniq = Array.from(new Set((visibleUserIds || []).filter(Boolean)));
    uniq.sort();
    return uniq.join(",");
  }, [visibleUserIds]);

  const heartbeatTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // --- Heartbeat: write my last_seen (so others can see me as online) ---
  const heartbeat = useCallback(async () => {
    if (!userId) return;

    // If user chose to hide, do not broadcast presence.
    if (hideOnline) return;

  const payload: any = {
    user_id: userId,
    last_seen: nowIso(),
    platform: platformName(),
    hide_status: hideOnline,
  };

    // Try upsert (works with your table right now)
    try {
      await supabase.from("user_presence").upsert(payload, { onConflict: "user_id" });
    } catch {
      // ignore (local UI still works)
    }
  }, [userId, hideOnline]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    // start heartbeat loop
    const start = () => {
      // run immediately
      void heartbeat();

      // clear existing
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      heartbeatTimerRef.current = window.setInterval(() => {
        void heartbeat();
      }, HEARTBEAT_MS);
    };

    start();

    const onVisibility = () => {
      // when app comes back, refresh quickly
      if (document.visibilityState === "visible") void heartbeat();
    };

    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [userId, heartbeat]);

  // --- Read presence for visible ids ---
  const refreshPresence = useCallback(async () => {
    const ids = Array.from(new Set((visibleUserIds || []).filter(Boolean))).slice(0, 200);
    if (ids.length === 0) {
      if (mountedRef.current) setPresenceMap({});
      return;
    }

    // Try selecting hide_status too (if you add it later). If column missing, retry without it.
    let rows: PresenceRow[] = [];

    try {
      const { data, error } = await supabase
        .from("user_presence")
        .select("user_id,last_seen,platform,hide_status")
        .in("user_id", ids);

      if (!error) rows = (data || []) as PresenceRow[];
      else throw error;
    } catch {
      try {
        const { data } = await supabase
          .from("user_presence")
          .select("user_id,last_seen,platform")
          .in("user_id", ids);

        rows = (data || []) as PresenceRow[];
      } catch {
        rows = [];
      }
    }

    // Build map: pick most recent last_seen per user_id
    const best: Record<string, PresenceInfo> = {};

    for (const r of rows) {
      const uid = r.user_id;
      if (!uid) continue;

      const prev = best[uid];
      const prevT = prev?.last_seen ? Date.parse(prev.last_seen) : -1;
      const t = r.last_seen ? Date.parse(r.last_seen) : -1;

      const next: PresenceInfo = {
        is_online: isOnlineFromLastSeen(r.last_seen ?? null),
        last_seen: r.last_seen ?? null,
        platform: r.platform ?? null,
        hide_status: typeof (r as any).hide_status === "boolean" ? !!(r as any).hide_status : undefined,
      };

      // keep the newest
      if (!prev || (Number.isFinite(t) && t > prevT)) {
        best[uid] = next;
      }
    }

    // Ensure every visible id exists in map (so dots can render consistently)
    for (const uid of ids) {
      if (!best[uid]) {
        best[uid] = { is_online: false, last_seen: null, platform: null };
      }
    }

    if (mountedRef.current) setPresenceMap(best);
  }, [visibleUserIds]);

  useEffect(() => {
    // refresh when visible ids change
    void refreshPresence();
    // and poll a bit so dots update
    const t = window.setInterval(() => {
      void refreshPresence();
    }, 20_000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIdsKey]);

  return useMemo(
    () => ({
      presenceMap,
      hideOnline,
      setHideOnline,
    }),
    [presenceMap, hideOnline]
  );
}