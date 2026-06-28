// src/hooks/useUserRoles.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = "admin" | "moderator" | "user";

function isNetworkLikeFailure(err: any) {
  const msg = String(err?.message || "");
  return (
    err?.name === "TypeError" ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("fetch")
  );
}

function isTimeoutFailure(err: any) {
  const msg = String(err?.message || "");
  return msg.toLowerCase().includes("timeout") || err?.name === "AbortError";
}

async function selectRolesWithAbort(userId: string, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    // AbortController is supported by supabase-js v2 for PostgREST calls
    const res = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .abortSignal(controller.signal);

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function useUserRoles() {
  const { user } = useAuth();

  const [roles, setRoles] = useState<UserRole[]>(["user"]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const isAdmin = useMemo(() => roles.includes("admin"), [roles]);

  // Prevent rapid re-fetch loops if something higher re-mounts frequently
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");

      const uid = user?.id || null;

      // No auth yet: safe default
      if (!uid) {
        if (!cancelled) {
          setRoles(["user"]);
          setLoading(false);
        }
        return;
      }

      // If we already fetched for this user in this mount cycle, don’t spam
      if (lastUserIdRef.current === uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      lastUserIdRef.current = uid;

      try {
        const res = await selectRolesWithAbort(uid, 12000);

        // PostgREST “table missing” / “permission denied” usually comes back here as res.error
        if ((res as any)?.error) throw (res as any).error;

        const data = ((res as any)?.data || []) as Array<{ role: UserRole | null }>;
        const next = data.map((r) => r.role).filter(Boolean) as UserRole[];

        if (!cancelled) {
          setRoles(next.length ? next : ["user"]);
        }
      } catch (e: any) {
        // Don’t crash the app for roles, ever.
        // Fall back to "user" and keep a small error label for debugging.
        const kind = isTimeoutFailure(e)
          ? "timeout"
          : isNetworkLikeFailure(e)
          ? "network"
          : e?.code
          ? String(e.code)
          : e?.message
          ? String(e.message)
          : "unknown";

        console.warn("[useUserRoles] roles fetch failed:", e);

        if (!cancelled) {
          setRoles(["user"]);
          setError(kind);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { roles, isAdmin, loading, error };
}