// src/pages/CallPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VideoCallEmbed from "@/components/VideoCallEmbed";
import { useActiveCall } from "@/hooks/useActiveCall";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type CallType = "video" | "audio";

// Keep status flexible (your schema changed over time)
type CallStatus = "pending" | "ringing" | "accepted" | "declined" | "ended" | string;

type CallInviteRowAny = {
  id: string;
  status: CallStatus;
  call_type?: CallType;
  room_url?: string;
  conversation_id?: string | null;

  // legacy columns (some older code)
  caller_id?: string;
  callee_id?: string;

  // other naming (some code paths)
  from_user_id?: string;
  to_user_id?: string;

  created_at?: string;
};

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function getCallerId(row: CallInviteRowAny | null): string {
  return String(row?.caller_id || row?.from_user_id || "");
}
function getCalleeId(row: CallInviteRowAny | null): string {
  return String(row?.callee_id || row?.to_user_id || "");
}

async function cancelInviteIfNotAnswered(inviteId: string, callerId: string) {
  if (!inviteId || !callerId) return;

  // Try both schemas safely. We attempt caller_id first, then from_user_id.
  let res = await supabase
    .from("call_invites")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", inviteId)
    .in("status", ["pending", "ringing"])
    .eq("caller_id", callerId);

  if ((res as any)?.error) {
    res = await supabase
      .from("call_invites")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", inviteId)
      .in("status", ["pending", "ringing"])
      .eq("from_user_id", callerId);
  }

  if ((res as any)?.error) {
    console.warn("[CallPage] cancelInviteIfNotAnswered failed", (res as any).error);
  }
}

async function endInvite(inviteId: string) {
  if (!inviteId) return;

  const { error } = await supabase
    .from("call_invites")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", inviteId)
    .neq("status", "ended");

  if (error) console.warn("[CallPage] endInvite failed", error);
}

export default function CallPage() {
  const query = useQuery();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { endCall } = useActiveCall();

  const inviteId = query.get("inviteId") ?? "";
  const callType = (query.get("callType") ?? "video") as CallType;
  const participantName = query.get("name") || "Partner";

  const myName =
    (user as any)?.user_metadata?.full_name ||
    (user as any)?.user_metadata?.fullName ||
    user?.email ||
    "Community Member";

  const [callRow, setCallRow] = useState<CallInviteRowAny | null>(null);
  const [status, setStatus] = useState<CallStatus>("ringing");

  const endingRef = useRef(false);

  const roomUrlParam = query.get("roomUrl") ?? "";
  const roomUrlFromDb = String(callRow?.room_url ?? "");

  const safeRoomUrl = useMemo(() => {
    const raw = String(roomUrlParam || roomUrlFromDb || "").trim();
    if (!raw) return "";
    if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
    return `https://${raw}`;
  }, [roomUrlParam, roomUrlFromDb]);

  const incoming = useMemo(() => {
    if (!callRow || !user) return false;
    const calleeId = getCalleeId(callRow);
    return !!calleeId && calleeId === user.id;
  }, [callRow, user]);

  // Caller joins immediately once roomUrl exists
  // Callee should wait until accepted
  const readyToJoin = useMemo(() => {
    if (!safeRoomUrl) return false;
    if (!incoming) return true;
    return status === "accepted";
  }, [incoming, safeRoomUrl, status]);

  const exitToMessages = useCallback(() => {
    try {
      void endCall();
    } catch {}
    navigate("/messages", { replace: true });
  }, [endCall, navigate]);

  // Validate minimal param early (inviteId only)
  useEffect(() => {
    if (!inviteId) {
      console.error("[CallPage] Missing inviteId. Redirecting.");
      exitToMessages();
    }
  }, [inviteId, exitToMessages]);

  // Load call_invites row (source of truth)
  useEffect(() => {
    if (!inviteId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("call_invites").select("*").eq("id", inviteId).maybeSingle();

      if (error) {
        console.error("[CallPage] Failed to load call_invites row", error);
        return;
      }
      if (cancelled) return;

      if (!data) {
        console.error("[CallPage] No invite row found. Redirecting.");
        exitToMessages();
        return;
      }

      const row = data as CallInviteRowAny;
      setCallRow(row);

      const s = (row?.status as CallStatus) || "ringing";
      setStatus(s);

      if (s === "declined" || s === "ended") {
        exitToMessages();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteId, exitToMessages]);

  // Validate roomUrl AFTER DB load chance
  useEffect(() => {
    if (!inviteId) return;

    if (callRow && (!safeRoomUrl || !safeRoomUrl.startsWith("https://"))) {
      console.error("[CallPage] Missing/invalid roomUrl after DB load. Redirecting.", {
        safeRoomUrl,
        roomUrlParam,
        roomUrlFromDb,
      });
      exitToMessages();
    }
  }, [inviteId, callRow, safeRoomUrl, roomUrlParam, roomUrlFromDb, exitToMessages]);

  // Realtime watch for status changes
  useEffect(() => {
    if (!inviteId) return;

    const ch = supabase
      .channel(`call-status-${inviteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_invites", filter: `id=eq.${inviteId}` },
        (payload) => {
          const next = payload.new as any;
          const nextStatus = next?.status as CallStatus;

          setCallRow(next as CallInviteRowAny);

          if (!nextStatus) return;

          console.log("[CallPage] status update:", nextStatus);
          setStatus(nextStatus);

          if (nextStatus === "declined" || nextStatus === "ended") {
            exitToMessages();
          }
        }
      )
      .subscribe((s) => console.log("[CallPage] channel:", s));

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [inviteId, exitToMessages]);

  const handleEndCall = useCallback(async () => {
    console.log("[END_SOURCE] CallPage cancel/end", { inviteId, status, incoming });

    if (!inviteId) return;
    if (endingRef.current) return;
    endingRef.current = true;

    try {
      const myId = user?.id ?? "";
      const callerId = getCallerId(callRow);

      // Caller cancel before accepted: only end if still not answered
      if (!incoming && (status === "pending" || status === "ringing")) {
        await cancelInviteIfNotAnswered(inviteId, myId || callerId);
      } else {
        // Otherwise end regardless (hangup / callee decline / connected end)
        await endInvite(inviteId);
      }
    } finally {
      endingRef.current = false;
      exitToMessages();
    }
  }, [inviteId, status, incoming, user?.id, callRow, exitToMessages]);

  if (!inviteId) return null;
  if (callRow === null) return null;
  if (!safeRoomUrl || !safeRoomUrl.startsWith("https://")) return null;

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      <div className="h-16 px-4 flex items-center justify-between bg-black/60 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex flex-col">
          <span className="text-white text-sm font-semibold">{participantName}</span>
          <span className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest">
            {callType === "audio" ? "Voice Session" : "Video Session"}
          </span>
          <span className="text-[10px] text-zinc-400">
            {incoming
              ? status === "ringing" || status === "pending"
                ? "Incoming call…"
                : `Status: ${status}`
              : status === "ringing" || status === "pending"
              ? "Calling…"
              : `Status: ${status}`}
          </span>
        </div>

        <button
          onClick={() => void handleEndCall()}
          className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase px-4 py-2 rounded-full transition-colors"
        >
          End Call
        </button>
      </div>

      <div className="flex-1 relative bg-black">
        {!readyToJoin ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="space-y-3">
              <div className="text-lg font-semibold">
                {incoming ? "Waiting for you to accept…" : `Calling ${participantName}…`}
              </div>
              <div className="text-sm text-zinc-400">
                {incoming ? "Accept on the incoming call popup to join." : "They can join once they accept."}
              </div>
              <div className="text-[10px] text-zinc-500">Status: {String(status)}</div>
            </div>
          </div>
        ) : (
          <VideoCallEmbed
            roomUrl={safeRoomUrl}
            userName={myName}
            isAudioOnly={callType === "audio"}
            onLeave={async () => {
              await handleEndCall();
            }}
          />
        )}
      </div>
    </div>
  );
}