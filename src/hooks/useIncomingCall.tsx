// src/hooks/useIncomingCall.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCall } from "@/hooks/useActiveCall";

type CallType = "video" | "audio";

export type CallInvite = {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  room_url: string | null;
  status: "pending" | "ringing" | "accepted" | "declined" | "ended" | string;
  conversation_id: string | null;
  created_at?: string;
};

type AcceptResult = {
  callType: CallType;
  roomUrl: string;
  inviteId: string;
  callerId: string;
  conversationId: string | null;
};

type Ctx = {
  invite: CallInvite | null;
  callerName: string | null;
  loading: boolean;
  accept: (inviteId: string) => Promise<AcceptResult | null>;
  decline: (inviteId: string) => Promise<void>;
  clear: () => void;
};

const IncomingCallContext = createContext<Ctx | undefined>(undefined);

function nowMs() {
  return Date.now();
}

function parseMs(iso?: string) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

async function safeGetMyId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export const IncomingCallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { updateCallState } = useActiveCall();

  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const actionLockRef = useRef<string | null>(null);
  const inviteIdRef = useRef<string | null>(null);
  const missedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneStartedForRef = useRef<string | null>(null);

  const stopRingtone = useCallback(() => {
    const audio = ringtoneRef.current;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}

    ringtoneStartedForRef.current = null;
  }, []);
const startRingtone = useCallback((inviteId: string) => {
  if (typeof window === "undefined") return;
  if (!inviteId) return;
  if (ringtoneStartedForRef.current === inviteId) return;

  try {
    if (!ringtoneRef.current) {
      const audio = new Audio("/ringtones/incoming-call.mp3");
      audio.loop = true;
      audio.preload = "auto";
      ringtoneRef.current = audio;
    }

    const audio = ringtoneRef.current;
    if (!audio) return;

    ringtoneStartedForRef.current = inviteId;

    try {
      audio.currentTime = 0;
      void audio.play().catch((err) => {
        console.warn("[IncomingCall] ringtone play blocked/failed", err);
      });
    } catch (err) {
      console.warn("[IncomingCall] ringtone setup failed", err);
    }

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate?.([300, 200, 300, 200, 300]);
      }
    } catch {}
  } catch (err) {
    console.warn("[IncomingCall] ringtone setup failed", err);
  }
}, []);


  const clearMissedTimeout = useCallback(() => {
    if (missedTimeoutRef.current) {
      clearTimeout(missedTimeoutRef.current);
      missedTimeoutRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    stopRingtone();
    clearMissedTimeout();
    inviteIdRef.current = null;
    actionLockRef.current = null;
    setInvite(null);
    setCallerName(null);
  }, [clearMissedTimeout, stopRingtone]);

  const fetchCallerName = useCallback(async (callerId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("user_id", callerId)
        .maybeSingle();

      const nm = (data as any)?.full_name || (data as any)?.username || null;
      setCallerName(typeof nm === "string" && nm.trim() ? nm.trim() : "Unknown");
    } catch {
      setCallerName("Unknown");
    }
  }, []);

  const armMissedCallTimeout = useCallback(
    (row: CallInvite) => {
      clearMissedTimeout();

      if (row.status !== "ringing") return;

      const created = parseMs(row.created_at);
      const elapsed = created ? nowMs() - created : 0;
      const remaining = Math.max(0, 35000 - elapsed);

      missedTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from("call_invites")
            .update({ status: "ended" })
            .eq("id", row.id)
            .eq("callee_id", row.callee_id)
            .eq("status", "ringing");

          if (inviteIdRef.current === row.id) {
            clear();
          }
        } catch (e) {
          console.warn("[IncomingCall] missed-timeout update failed", e);
        }
      }, remaining);
    },
    [clear, clearMissedTimeout]
  );

  const setIncomingInvite = useCallback(
    async (row: CallInvite | null) => {
      if (!row) {
        clear();
        return;
      }

      if (row.status === "declined" || row.status === "ended") {
        if (inviteIdRef.current === row.id) clear();
        return;
      }

      inviteIdRef.current = row.id;
      setInvite(row);

      updateCallState({
        id: row.id,
        callInviteId: row.id,
        callType: row.call_type,
        callState: row.status === "ringing" ? "incoming" : "incoming",
        otherUserId: row.caller_id,
        otherUserName: callerName ?? "Caller",
        conversationId: row.conversation_id ?? null,
        roomUrl: String(row.room_url || "").trim(),
      });

      void fetchCallerName(row.caller_id);
      armMissedCallTimeout(row);

      if (row.status === "ringing") {
        startRingtone(row.id);
      } else {
        stopRingtone();
      }
    },
    [armMissedCallTimeout, callerName, clear, fetchCallerName, startRingtone, stopRingtone, updateCallState]
  );

  const fetchLatestRinging = useCallback(async (myId: string) => {
    try {
      const { data, error } = await supabase
        .from("call_invites")
        .select("id, caller_id, callee_id, call_type, room_url, status, conversation_id, created_at")
        .eq("callee_id", myId)
        .eq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return (data as any) as CallInvite | null;
    } catch {
      return null;
    }
  }, []);

  const accept = useCallback(
    async (inviteId: string): Promise<AcceptResult | null> => {
      if (!inviteId) return null;
      if (actionLockRef.current) return null;
      actionLockRef.current = `accept:${inviteId}`;

      try {
        const myId = user?.id ?? (await safeGetMyId());
        if (!myId) return null;

        const { data, error } = await supabase
          .from("call_invites")
          .update({ status: "accepted" })
          .eq("id", inviteId)
          .eq("callee_id", myId)
          .eq("status", "ringing")
          .select("id, caller_id, callee_id, call_type, room_url, status, conversation_id, created_at")
          .maybeSingle();

        if (error || !data) {
          clear();
          return null;
        }

        const row = data as any as CallInvite;
        const roomUrl = String(row.room_url || "").trim();

        if (!roomUrl) {
          await supabase
            .from("call_invites")
            .update({ status: "ended" })
            .eq("id", inviteId)
            .eq("callee_id", myId)
            .eq("status", "accepted");

          clear();
          return null;
        }

        stopRingtone();
        clearMissedTimeout();

        updateCallState({
          id: row.id,
          callInviteId: row.id,
          callType: row.call_type,
          callState: "connected",
          roomUrl,
          otherUserId: row.caller_id,
          otherUserName: callerName || "Caller",
          conversationId: row.conversation_id ?? null,
        });

        return {
          callType: row.call_type,
          roomUrl,
          inviteId: row.id,
          callerId: row.caller_id,
          conversationId: row.conversation_id ?? null,
        };
      } catch (e) {
        console.error("[IncomingCall] accept failed", e);
        return null;
      } finally {
        actionLockRef.current = null;
      }
    },
    [callerName, clear, clearMissedTimeout, stopRingtone, updateCallState, user?.id]
  );

  const decline = useCallback(
    async (inviteId: string) => {
      if (!inviteId) return;
      if (actionLockRef.current) return;
      actionLockRef.current = `decline:${inviteId}`;

      try {
        const myId = user?.id ?? (await safeGetMyId());
        if (!myId) return;

        await supabase
          .from("call_invites")
          .update({ status: "declined" })
          .eq("id", inviteId)
          .eq("callee_id", myId)
          .eq("status", "ringing");
      } catch (e) {
        console.warn("[IncomingCall] decline failed", e);
      } finally {
        actionLockRef.current = null;
        clear();
      }
    },
    [clear, user?.id]
  );

  useEffect(() => {
    let cancelled = false;

    const myId = user?.id;
    if (!myId) {
      setLoading(false);
      clear();
      return;
    }

    setLoading(true);

    const cleanup = () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      clearMissedTimeout();
      stopRingtone();
    };

    const boot = async () => {
      const first = await fetchLatestRinging(myId);
      if (!cancelled) {
        await setIncomingInvite(first);
        setLoading(false);
      }

      channelRef.current = supabase
        .channel(`incoming-call:${myId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_invites",
            filter: `callee_id=eq.${myId}`,
          },
          async (payload: any) => {
            if (cancelled) return;

            const next = payload?.new as CallInvite | undefined;
            if (!next) return;

            if (next.status === "ringing") {
              await setIncomingInvite(next);
              return;
            }

            if (next.status === "accepted") {
              if (inviteIdRef.current === next.id) clear();
              return;
            }

            if (next.status === "declined" || next.status === "ended") {
              if (inviteIdRef.current === next.id) clear();
            }
          }
        )
        .subscribe();

      pollRef.current = setInterval(async () => {
        if (cancelled) return;

        const current = inviteIdRef.current;

        if (current) {
          try {
            const { data } = await supabase
              .from("call_invites")
              .select("id, caller_id, callee_id, call_type, room_url, status, conversation_id, created_at")
              .eq("id", current)
              .maybeSingle();

            const row = data as any as CallInvite | null;
            if (!row) return;

            if (row.status === "declined" || row.status === "ended" || row.status === "accepted") {
              clear();
              return;
            }

            if (row.status === "ringing") {
              armMissedCallTimeout(row);
              startRingtone(row.id);
            }
          } catch {}
          return;
        }

        const latest = await fetchLatestRinging(myId);
        if (latest) await setIncomingInvite(latest);
      }, 2000);
    };

    void boot();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    armMissedCallTimeout,
    clear,
    clearMissedTimeout,
    fetchLatestRinging,
    setIncomingInvite,
    startRingtone,
    stopRingtone,
    user?.id,
  ]);

  const value = useMemo<Ctx>(
    () => ({
      invite,
      callerName,
      loading,
      accept,
      decline,
      clear,
    }),
    [accept, callerName, clear, decline, invite, loading]
  );

  return <IncomingCallContext.Provider value={value}>{children}</IncomingCallContext.Provider>;
};

export const useIncomingCall = () => {
  const ctx = useContext(IncomingCallContext);
  if (!ctx) throw new Error("useIncomingCall must be used within an IncomingCallProvider");
  return ctx;
};