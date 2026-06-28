// src/components/VideoCallButton.tsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCall } from "@/hooks/useActiveCall";
import { Button } from "@/components/ui/button";
import { Phone, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensureVideoCallPermissions, ensureAudioCallPermissions } from "@/utils/permissions";

type CallType = "video" | "audio";

type Props = {
  conversationId?: string | null;
  calleeId: string;
  calleeName?: string;
  disabled?: boolean;
  edgeFunctionName?: string;
};

type CallInviteRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  room_url: string | null;
  status: string;
  conversation_id: string | null;
};

function randomToken(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });

  try {
    return await Promise.race([Promise.resolve(p), timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function createRoomUrl(callType: CallType, fn?: string): Promise<string> {
  const edgeFn = fn || "create-daily-room";

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const res = await withTimeout(
    supabase.functions.invoke(edgeFn, {
      body: { roomName: `call-${Date.now()}-${randomToken(8)}`, callType },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    12000,
    "create-room"
  );

  const invokeErr = (res as any)?.error;
  if (invokeErr) throw new Error(invokeErr?.message || "Edge Function failed");

  const data = (res as any)?.data;
  const url = data?.roomUrl || data?.url || data?.room_url;

  if (typeof url !== "string" || !url.trim()) {
    throw new Error("Room creation returned no roomUrl");
  }

  return url.trim();
}

export default function VideoCallButton({
  conversationId = null,
  calleeId,
  calleeName = "User",
  disabled,
  edgeFunctionName = "create-daily-room",
}: Props) {
  const { user } = useAuth();
  const { activeCall, updateCallState } = useActiveCall();
  const navigate = useNavigate();

  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const busy = loadingVideo || loadingAudio;

  const killRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingWatchRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const statusToastRef = useRef<string | number | null>(null);

  const activeCallStateRef = useRef<string | null>(null);
  useEffect(() => {
    activeCallStateRef.current = activeCall?.callState ?? null;
  }, [activeCall?.callState]);

  const showStatusToast = useCallback((message: string) => {
    if (statusToastRef.current) {
      toast.dismiss(statusToastRef.current);
    }
    statusToastRef.current = toast.error(message, { duration: 2500 });
  }, []);

  const cleanupOutgoingWatch = useCallback(() => {
    if (outgoingWatchRef.current) {
      try {
        supabase.removeChannel(outgoingWatchRef.current);
      } catch {}
      outgoingWatchRef.current = null;
    }
  }, []);

  const cleanupKill = useCallback(() => {
    if (killRef.current) clearTimeout(killRef.current);
    killRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupKill();
      cleanupOutgoingWatch();
      if (statusToastRef.current) {
        toast.dismiss(statusToastRef.current);
        statusToastRef.current = null;
      }
    };
  }, [cleanupKill, cleanupOutgoingWatch]);

  const armKill = useCallback(() => {
    cleanupKill();
    killRef.current = setTimeout(() => {
      setLoadingVideo(false);
      setLoadingAudio(false);
    }, 20000);
  }, [cleanupKill]);

  const disarmKill = useCallback(() => {
    cleanupKill();
  }, [cleanupKill]);

  const canCall = useMemo(() => !disabled && !!calleeId, [disabled, calleeId]);

  const startCall = useCallback(
    async (callType: CallType) => {
      if (!canCall || busy) return;

      const myId = user?.id;
      if (!myId) return void toast.error("Please sign in");
      if (calleeId === myId) return void toast.error("You cannot call yourself");
      if (!conversationId) return void toast.error("Missing conversation");

      try {
        if (callType === "video") setLoadingVideo(true);
        else setLoadingAudio(true);

        armKill();

        const ok = await withTimeout(
          callType === "video" ? ensureVideoCallPermissions() : ensureAudioCallPermissions(),
          12000,
          "permissions"
        );

        if (!ok) {
          toast.error("Permissions denied");
          return;
        }

        const roomUrl = await createRoomUrl(callType, edgeFunctionName);

        if (!roomUrl || !roomUrl.startsWith("http")) {
          console.error("[CALL_BTN] Invalid roomUrl:", roomUrl);
          toast.error("Room creation failed");
          disarmKill();
          return;
        }

        const insert = await withTimeout(
          supabase
            .from("call_invites")
            .insert({
              caller_id: myId,
              callee_id: calleeId,
              call_type: callType,
              room_url: roomUrl,
              status: "ringing",
              conversation_id: conversationId,
            })
            .select("*")
            .single(),
          12000,
          "insert-invite"
        );

        const invite: CallInviteRow | null = (insert as any)?.data ?? null;
        const insertErr = (insert as any)?.error;

        if (insertErr || !invite) {
          console.error("[CALL_BTN] insert failed", insertErr);
          toast.error("Failed to create call invite");
          return;
        }

        const callerNameForPush =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          "Someone";

        const finalRoomUrl = String(invite.room_url || roomUrl || "").trim();
        if (!finalRoomUrl) {
          toast.error("Room URL missing");
          return;
        }

        // Open call UI immediately after invite is ready
        updateCallState({
          id: invite.id,
          callInviteId: invite.id,
          callType: invite.call_type,
          callState: "calling",
          otherUserId: invite.callee_id,
          otherUserName: calleeName || "User",
          conversationId: invite.conversation_id ?? conversationId ?? null,
          roomUrl: finalRoomUrl,
        });

        navigate(
          {
            pathname: "/call",
            search:
              `?callType=${callType}` +
              `&calleeId=${encodeURIComponent(calleeId)}` +
              `&calleeName=${encodeURIComponent(calleeName)}` +
              `&conversationId=${encodeURIComponent(conversationId)}` +
              `&roomUrl=${encodeURIComponent(finalRoomUrl)}` +
              `&inviteId=${encodeURIComponent(invite.id)}`,
          },
          { replace: true }
        );

        // Send pushes in parallel after navigation so UI feels faster
        const pushBody = {
          user_id: calleeId,
          title: `Incoming ${callType} call`,
          body: `from ${callerNameForPush}`,
          metadata: {
            invite_id: invite.id,
            room_url: finalRoomUrl,
            call_type: invite.call_type,
            conversation_id: invite.conversation_id ?? conversationId ?? null,
            from_user_id: myId,
            caller_name: callerNameForPush,
          },
        };

        void Promise.allSettled([
          supabase.functions.invoke("send-fcm", { body: pushBody }),
          supabase.functions.invoke("send-ios-voip-push", { body: pushBody }),
        ]).then((results) => {
          const [androidResult, iosResult] = results;

          if (androidResult.status === "fulfilled") {
            console.log("[CALL_BTN] send-fcm data:", JSON.stringify(androidResult.value?.data));
            console.log("[CALL_BTN] send-fcm error:", JSON.stringify(androidResult.value?.error));
          } else {
            console.warn("[CALL_BTN] send-fcm failed:", androidResult.reason);
          }

          if (iosResult.status === "fulfilled") {
            console.log("[CALL_BTN] send-ios-voip-push data:", JSON.stringify(iosResult.value?.data));
            console.log("[CALL_BTN] send-ios-voip-push error:", JSON.stringify(iosResult.value?.error));
          } else {
            console.warn("[CALL_BTN] send-ios-voip-push failed:", iosResult.reason);
          }
        });

        cleanupOutgoingWatch();

        outgoingWatchRef.current = supabase
          .channel(`caller-watch-${invite.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "call_invites", filter: `id=eq.${invite.id}` },
            (payload: any) => {
              const next = payload?.new;
              const status = next?.status as string | undefined;
              if (!status) return;

              if (status === "accepted") {
                disarmKill();
                updateCallState({ callState: "connected" });
                return;
              }

              if (status === "declined") {
                disarmKill();
                cleanupOutgoingWatch();
                showStatusToast("Call declined");
                updateCallState({ callState: "ended" });
                return;
              }

              if (status === "ended") {
                disarmKill();
                cleanupOutgoingWatch();

                const prevState = activeCallStateRef.current;
                const wasDialing = prevState === "calling" || prevState === "waiting" || prevState === "ringing";

                if (wasDialing) {
                  showStatusToast("Missed call");
                  updateCallState({ callState: "no-answer" });
                } else {
                  showStatusToast("Call ended");
                  updateCallState({ callState: "ended" });
                }
              }
            }
          )
          .subscribe();
      } catch (err: any) {
        console.error("[CALL_BTN] startCall error", err);
        disarmKill();
        cleanupOutgoingWatch();
        toast.error(err?.message || "Call failed");
      } finally {
        setLoadingVideo(false);
        setLoadingAudio(false);
      }
    },
    [
      armKill,
      busy,
      calleeId,
      calleeName,
      canCall,
      cleanupOutgoingWatch,
      conversationId,
      disarmKill,
      edgeFunctionName,
      navigate,
      showStatusToast,
      updateCallState,
      user?.id,
      user?.email,
      user?.user_metadata,
    ]
  );

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        disabled={!canCall || busy}
        variant="outline"
        onClick={() => void startCall("audio")}
        className="gap-2"
      >
        {loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        Audio
      </Button>

      <Button
        type="button"
        disabled={!canCall || busy}
        onClick={() => void startCall("video")}
        className="gap-2"
      >
        {loadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
        Video
      </Button>
    </div>
  );
}