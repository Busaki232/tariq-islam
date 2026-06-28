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
  id?: string; // invite id (preferred)
  callInviteId?: string; // back-compat
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

export const ActiveCallProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // prevent DB spam
  const lastEndedIdRef = useRef<string | null>(null);

  // caller-side "no answer" timer
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
      const { error } = await supabase
        .from("call_invites")
        .update({ status: "ended" })
        .eq("id", inviteId);

      if (error) console.warn("[ActiveCall] markInviteEnded error:", error);
    } catch (err) {
      console.warn("[ActiveCall] markInviteEnded exception:", err);
    }
  }, []);

  const armOutgoingNoAnswerTimeout = useCallback((inviteId?: string | null) => {
    clearOutgoingRingTimeout();
    if (!inviteId) return;

    outgoingRingTimeoutRef.current = setTimeout(async () => {
      try {
        // Only end if still ringing
        await supabase
          .from("call_invites")
          .update({ status: "ended" })
          .eq("id", inviteId)
          .eq("status", "ringing");

        // Mark UI state as missed/no-answer
        setActiveCall((prev) => {
          if (!prev) return prev;
          const prevId = prev.id ?? prev.callInviteId;
          if (prevId !== inviteId) return prev;
          if (prev.callState === "connected") return prev;
          return { ...prev, callState: "no-answer" };
        });
      } catch (e) {
        console.warn("[ActiveCall] no-answer timeout update failed", e);
      }
    }, 35000);
  }, [clearOutgoingRingTimeout]);

  const startCall = useCallback(
    (call: StartCallInput) => {
      const id = (call as any).id ?? (call as any).callInviteId;

      setActiveCall({
        ...(call as any),
        id,
        callInviteId: (call as any).callInviteId ?? id,
        callState: call.callState || "calling",
      });

      // If caller is placing call, arm missed-call timeout
      const cs = call.callState || "calling";
      if (cs === "calling" || cs === "waiting") {
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
        if (typeof arg === "string") {
          if (!prev) return prev;

          // stop missed-call timer once state is not ringing/calling
          if (arg === "connected" || arg === "declined" || arg === "ended" || arg === "no-answer") {
            clearOutgoingRingTimeout();
          }

          return { ...prev, callState: arg };
        }

        const patch = arg || {};

        if (!prev) {
          const nextId = patch.id ?? patch.callInviteId ?? undefined;
          const created: ActiveCall = {
            id: nextId,
            callInviteId: patch.callInviteId ?? nextId,
            roomUrl: (patch.roomUrl as any) ?? "",
            callType: (patch.callType as any) ?? "video",
            callState: (patch.callState as any) ?? "calling",
            otherUserId: patch.otherUserId,
            otherUserName: patch.otherUserName,
            conversationId: patch.conversationId ?? null,
            groupId: patch.groupId ?? null,
            ...(patch as any),
          };

          // arm timeout if newly created call is outgoing
          if (created.callState === "calling" || created.callState === "waiting") {
            armOutgoingNoAnswerTimeout((created.id ?? created.callInviteId) ?? null);
          }

          return created;
        }

        const nextId = patch.id ?? patch.callInviteId ?? prev.id ?? prev.callInviteId;

        const updated: ActiveCall = {
          ...prev,
          ...(patch as any),
          id: nextId,
          callInviteId: patch.callInviteId ?? nextId ?? prev.callInviteId,
        };

        // Manage timeout based on updated state
        if (updated.callState === "calling" || updated.callState === "waiting") {
          armOutgoingNoAnswerTimeout((updated.id ?? updated.callInviteId) ?? null);
        } else {
          clearOutgoingRingTimeout();
        }

        return updated;
      });
    },
    [armOutgoingNoAnswerTimeout, clearOutgoingRingTimeout]
  );

  const endCall = useCallback(async () => {
    clearOutgoingRingTimeout();
    const inviteId = activeCall?.id ?? activeCall?.callInviteId ?? null;
    await markInviteEnded(inviteId);
    setActiveCall(null);
  }, [activeCall?.id, activeCall?.callInviteId, clearOutgoingRingTimeout, markInviteEnded]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearOutgoingRingTimeout();
    };
  }, [clearOutgoingRingTimeout]);

  const value = useMemo(
    () => ({ activeCall, startCall, endCall, updateCallState }),
    [activeCall, startCall, endCall, updateCallState]
  );

  return <ActiveCallContext.Provider value={value}>{children}</ActiveCallContext.Provider>;
};

export const useActiveCall = () => {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) throw new Error("useActiveCall must be used within an ActiveCallProvider");
  return ctx;
};