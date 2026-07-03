// src/hooks/useActiveCall.tsx
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

export type CallState =
  | "calling"
  | "waiting"
  | "incoming"
  | "ringing"
  | "connected"
  | "declined"
  | "no-answer"
  | "ended";

export type CallType = "video" | "audio";

export interface ActiveCall {
  id?: string;
  callInviteId?: string;
  roomUrl: string;
  callType: CallType;
  otherUserName?: string;
  otherUserId?: string;
  conversationId?: string | null;
  groupId?: string | null;
  callState: CallState;
}

type StartCallInput = Omit<ActiveCall, "callState"> & { callState?: CallState };
type UpdateCallArg = CallState | Partial<ActiveCall>;

interface ActiveCallContextType {
  activeCall: ActiveCall | null;
  startCall: (call: StartCallInput) => void;
  endCall: () => Promise<void>;
  updateCallState: (arg: UpdateCallArg) => void;
}

const ActiveCallContext = createContext<ActiveCallContextType | undefined>(undefined);

const CALL_TIMEOUT_MS = 35000;

async function createCallLog(call: ActiveCall) {
  try {
    const inviteId = call.id ?? call.callInviteId;

    await (supabase as any).from("call_logs").insert({
      call_invite_id: inviteId,
      caller_id: call.callState === "incoming" ? call.otherUserId : null,
      receiver_id: call.callState === "incoming" ? null : call.otherUserId,
      call_type: call.callType,
      conversation_id: call.conversationId ?? null,
      status: "started",
      started_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[ActiveCall] createCallLog failed", e);
  }
}

async function finishCallLog(inviteId?: string | null, status = "ended") {
  if (!inviteId) return;

  try {
    await (supabase as any)
      .from("call_logs")
      .update({
        status,
        ended_at: new Date().toISOString(),
      })
      .eq("call_invite_id", inviteId);
  } catch (e) {
    console.warn("[ActiveCall] finishCallLog failed", e);
  }
}

export const ActiveCallProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  const lastEndedIdRef = useRef<string | null>(null);
  const outgoingRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOutgoingRingTimeout = useCallback(() => {
    if (outgoingRingTimeoutRef.current) {
      clearTimeout(outgoingRingTimeoutRef.current);
      outgoingRingTimeoutRef.current = null;
    }
  }, []);

  const markInviteEnded = useCallback(async (inviteId?: string | null) => {
    if (!inviteId) return;
    if (lastEndedIdRef.current === inviteId) return;

    lastEndedIdRef.current = inviteId;

    try {
      await supabase.from("call_invites").update({ status: "ended" }).eq("id", inviteId);
      await finishCallLog(inviteId, "ended");
    } catch (err) {
      console.warn("[ActiveCall] markInviteEnded exception:", err);
    }
  }, []);

  const armOutgoingNoAnswerTimeout = useCallback(
    (inviteId?: string | null) => {
      clearOutgoingRingTimeout();
      if (!inviteId) return;

      outgoingRingTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from("call_invites")
            .update({ status: "ended" })
            .eq("id", inviteId)
            .eq("status", "ringing");

          await finishCallLog(inviteId, "missed");

          setActiveCall((prev) => {
            if (!prev) return prev;
            return { ...prev, callState: "no-answer" };
          });
        } catch (e) {
          console.warn("[ActiveCall] no-answer timeout failed", e);
        }
      }, CALL_TIMEOUT_MS);
    },
    [clearOutgoingRingTimeout]
  );

  const startCall = useCallback(
    (call: StartCallInput) => {
      const id = (call as any).id ?? (call as any).callInviteId;

      const newCall: ActiveCall = {
        ...(call as any),
        id,
        callInviteId: (call as any).callInviteId ?? id,
        callState: call.callState || "calling",
      };

      setActiveCall(newCall);

      void createCallLog(newCall);

      if (newCall.callState === "calling" || newCall.callState === "waiting") {
        armOutgoingNoAnswerTimeout(id ?? null);
      } else {
        clearOutgoingRingTimeout();
      }
    },
    [armOutgoingNoAnswerTimeout, clearOutgoingRingTimeout]
  );

  const updateCallState = useCallback(
    (arg: UpdateCallArg) => {
      setActiveCall((prev) => {
        if (!prev) return prev;

        if (typeof arg === "string") {
          if (
            arg === "connected" ||
            arg === "declined" ||
            arg === "ended" ||
            arg === "no-answer"
          ) {
            clearOutgoingRingTimeout();
          }

          if (arg === "declined") {
            void finishCallLog(prev.id ?? prev.callInviteId, "declined");
          }

          return { ...prev, callState: arg };
        }

        const updated = {
          ...prev,
          ...(arg as any),
        };

        if (updated.callState === "connected") {
          clearOutgoingRingTimeout();
        }

        return updated;
      });
    },
    [clearOutgoingRingTimeout]
  );

  const endCall = useCallback(async () => {
    clearOutgoingRingTimeout();

    const inviteId = activeCall?.id ?? activeCall?.callInviteId ?? null;

    await markInviteEnded(inviteId);

    setActiveCall(null);
  }, [activeCall?.id, activeCall?.callInviteId, clearOutgoingRingTimeout, markInviteEnded]);

  useEffect(() => {
    return () => {
      clearOutgoingRingTimeout();
    };
  }, [clearOutgoingRingTimeout]);

  const value = useMemo(
    () => ({
      activeCall,
      startCall,
      endCall,
      updateCallState,
    }),
    [activeCall, startCall, endCall, updateCallState]
  );

  return (
    <ActiveCallContext.Provider value={value}>
      {children}
    </ActiveCallContext.Provider>
  );
};

export const useActiveCall = () => {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) {
    throw new Error("useActiveCall must be used within an ActiveCallProvider");
  }
  return ctx;
};