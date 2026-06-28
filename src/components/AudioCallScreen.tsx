// src/components/AudioCallScreen.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { Capacitor } from "@capacitor/core";
import {
  DailyProvider,
  DailyAudio,
  useDaily,
  useDailyEvent,
  useParticipantIds,
} from "@daily-co/daily-react";
import { Phone, Mic, MicOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveCall } from "@/hooks/useActiveCall";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CallingScreen from "@/components/CallingScreen";

interface AudioCallContentProps {
  otherUserName?: string;
  onLeave: () => void;
  onParticipantJoined: () => void;
}

const AudioCallContent = ({ otherUserName, onLeave, onParticipantJoined }: AudioCallContentProps) => {
  const daily = useDaily();
  const participantIds = useParticipantIds({ filter: "remote" });

  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const hasNotifiedParticipantJoined = useRef(false);

  useEffect(() => {
    if (!daily) return;
    try {
      daily.setLocalAudio(!isMuted);
    } catch {}
  }, [daily, isMuted]);

  useDailyEvent(
    "joined-meeting",
    useCallback(() => {
      console.log("[AudioCall] joined-meeting");
      setIsJoined(true);
      setIsJoining(false);
      setIsReconnecting(false);
    }, [])
  );

  useDailyEvent(
    "left-meeting",
    useCallback(() => {
      console.log("[AudioCall] left-meeting");
      setIsJoined(false);
    }, [])
  );

  useDailyEvent(
    "network-connection",
    useCallback((event: any) => {
      const ev = event?.event;
      if (ev === "interrupted") setIsReconnecting(true);
      if (ev === "connected") setIsReconnecting(false);
    }, [])
  );

  useDailyEvent(
    "error",
    useCallback((event: any) => {
      console.error("[AudioCall] Daily error:", event);
      setIsJoining(false);
      setIsReconnecting(false);
      toast.error("Call error", {
        description: event?.errorMsg || "There was an issue with the call",
      });
    }, [])
  );

  useEffect(() => {
    if (!isJoined) return;
    const interval = window.setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isJoined]);

  useEffect(() => {
    if (participantIds.length > 0 && !hasNotifiedParticipantJoined.current) {
      hasNotifiedParticipantJoined.current = true;
      onParticipantJoined();
    }
  }, [participantIds, onParticipantJoined]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleMute = useCallback(() => {
    if (!daily) return;
    const nextMuted = !isMuted;
    try {
      daily.setLocalAudio(!nextMuted);
    } catch {}
    setIsMuted(nextMuted);
  }, [daily, isMuted]);

  const handleLeave = useCallback(() => {
    try {
      daily?.setLocalAudio(false);
    } catch {}
    daily?.leave().catch(() => {});
    onLeave();
  }, [daily, onLeave]);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 to-black flex flex-col">
      <DailyAudio maxSpeakers={5} />

      {(isJoining || isReconnecting) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-white text-lg">{isReconnecting ? "Reconnecting..." : "Connecting..."}</p>
          </div>
        </div>
      )}

      <div className="p-4 text-center">
        <p className="text-white/60 text-sm">{isJoining ? "Connecting..." : "In call"}</p>
        {isJoined && <p className="text-white text-lg font-medium">{formatDuration(callDuration)}</p>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-6">
          <User className="w-16 h-16 text-gray-400" />
        </div>
        <h2 className="text-white text-2xl font-semibold mb-2">{otherUserName || "Audio Call"}</h2>
        <p className="text-white/60">
          {participantIds.length > 0 ? `${participantIds.length + 1} participants` : "Waiting for them to join…"}
        </p>
      </div>

      <div className="p-8 flex justify-center gap-6">
        <Button
          variant="outline"
          size="lg"
          onClick={toggleMute}
          className={`rounded-full w-16 h-16 ${
            isMuted ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/10 border-white/20 text-white"
          }`}
          aria-label="Toggle microphone"
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={handleLeave}
          className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
          aria-label="Hang up"
        >
          <Phone className="w-6 h-6 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
};

interface AudioCallWrapperProps {
  roomUrl: string;
  otherUserName?: string;
  onLeave: () => void;
  onParticipantJoined: () => void;
}

const GLOBAL_DAILY_AUDIO_KEY = "__TI_DAILY_AUDIO_CALL_OBJECT__";

function getGlobalAudioCallObject(): DailyCall | null {
  return ((globalThis as any)[GLOBAL_DAILY_AUDIO_KEY] as DailyCall | null) ?? null;
}

function setGlobalAudioCallObject(co: DailyCall | null) {
  (globalThis as any)[GLOBAL_DAILY_AUDIO_KEY] = co;
}

const AudioCallWrapper = ({ roomUrl, otherUserName, onLeave, onParticipantJoined }: AudioCallWrapperProps) => {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callObjectRef = useRef<DailyCall | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);

  const clearJoinTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const teardown = useCallback(async () => {
    clearJoinTimeout();
    startingRef.current = false;

    const co = callObjectRef.current;
    callObjectRef.current = null;

    const globalCo = getGlobalAudioCallObject();
    if (globalCo && globalCo === co) setGlobalAudioCallObject(null);

    if (co) {
      try {
        try {
          co.setLocalAudio(false);
        } catch {}
        await co.leave();
      } catch {}
      try {
        await co.destroy();
      } catch {}
    }

    setCallObject(null);
  }, [clearJoinTimeout]);

  useEffect(() => {
    let cancelled = false;

    const startOnce = async () => {
      if (!roomUrl) return;
      if (startingRef.current) return;
      startingRef.current = true;

      setError(null);

      const existing = getGlobalAudioCallObject();
      if (existing) {
        try {
          existing.setLocalAudio(false);
        } catch {}
        try {
          await existing.leave();
        } catch {}
        try {
          await existing.destroy();
        } catch {}
        setGlobalAudioCallObject(null);
      }

      await teardown();

      try {
        const { ensureMediaPermissions } = await import("@/utils/permissions");
        const hasPermissions = await ensureMediaPermissions("audio");
        if (!hasPermissions) {
          setError("Microphone access required");
          return;
        }

        if (cancelled) return;

        const co = DailyIframe.createCallObject({
          startVideoOff: true,
          startAudioOff: false,
        });

        setGlobalAudioCallObject(co);
        callObjectRef.current = co;
        setCallObject(co);

        const onDailyError = (e: any) => console.log("[AudioCall] daily-error", e);
        const onJoined = () => {
          console.log("[AudioCall] joined-meeting (wrapper)");
          clearJoinTimeout();
        };

        co.on("error" as any, onDailyError);
        co.on("joined-meeting" as any, onJoined);

        if (!Capacitor.isNativePlatform()) {
          try {
            await (co as any).startCamera?.({ audioSource: true, videoSource: false });
            console.log("[AudioCall] startCamera(audio) ok");
          } catch (e) {
            console.log("[AudioCall] startCamera(audio) failed", e);
          }
        }

        timeoutRef.current = setTimeout(() => {
          if (!cancelled) {
            setError("Join timed out");
            void teardown();
          }
        }, 20000);

        console.log("[AudioCall] joining room:", roomUrl);
        await co.join({ url: roomUrl });

        if (cancelled) {
          try {
            co.off?.("error" as any, onDailyError);
            co.off?.("joined-meeting" as any, onJoined);
          } catch {}
          await teardown();
          return;
        }

        try {
          co.setLocalAudio(true);
          console.log("[AudioCall] forced publish after join");
        } catch {}
      } catch (err: any) {
        console.error("[AudioCall] init/join failed:", err);
        const msg = err?.message || "Failed to join call";
        setError(msg);
        toast.error("Failed to join call", { description: String(msg).substring(0, 140) });
        void teardown();
      } finally {
        if (!cancelled) startingRef.current = false;
      }
    };

    void startOnce();

    return () => {
      cancelled = true;
      void teardown();
    };
  }, [roomUrl, teardown, clearJoinTimeout]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            void teardown().finally(() => onLeave());
          }}
          className="text-white border-white/20"
        >
          Close
        </Button>
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Starting audio call...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <AudioCallContent otherUserName={otherUserName} onLeave={onLeave} onParticipantJoined={onParticipantJoined} />
    </DailyProvider>
  );
};

export const AudioCallScreen = () => {
  const { user } = useAuth();
  const { activeCall, endCall, updateCallState } = useActiveCall();

  const myId = user?.id ?? "";

  const handleParticipantJoined = useCallback(() => {
    console.log("[AudioCall] Remote participant joined -> connected");
    updateCallState({ callState: "connected" });
  }, [updateCallState]);

  const markInviteStatus = useCallback(
    async (status: "accepted" | "declined" | "ended") => {
      const callId = activeCall?.id ?? activeCall?.callInviteId;
      if (!callId || !myId) return;

      const { error } = await supabase
        .from("call_invites")
        .update({ status })
        .eq("id", callId)
        .or(`caller_id.eq.${myId},callee_id.eq.${myId}`);

      if (error) console.warn("[AudioCall] update invite status failed", error);
    },
    [activeCall?.id, activeCall?.callInviteId, myId]
  );

  const handleLeave = useCallback(async () => {
    await markInviteStatus("ended");
    await endCall();
  }, [markInviteStatus, endCall]);

  const handleAccept = useCallback(async () => {
    try {
      const callId = activeCall?.id ?? activeCall?.callInviteId;
      if (!myId || !callId) return;

      const { data, error } = await supabase
        .from("call_invites")
        .update({ status: "accepted" })
        .eq("id", callId)
        .eq("callee_id", myId)
        .eq("status", "ringing")
        .select("id, room_url, call_type, status, caller_id, callee_id, conversation_id")
        .maybeSingle();

      if (error) {
        toast.error(`Accept failed: ${error.message}`);
        return;
      }
      if (!data) {
        toast.error("Accept failed: call already handled or not found");
        return;
      }

      const finalRoomUrl = String((data as any)?.room_url || activeCall?.roomUrl || "").trim();
      if (!finalRoomUrl) {
        toast.error("Accept failed: missing room url");
        return;
      }

      updateCallState({
        id: (data as any).id,
        callInviteId: (data as any).id,
        callType: "audio",
        callState: "connected",
        roomUrl: finalRoomUrl,
        otherUserId: (data as any).caller_id,
        conversationId: (data as any).conversation_id ?? null,
      });

      toast.success("Connecting...");
    } catch (e: any) {
      console.error("[AudioCall] accept exception", e);
      toast.error(e?.message || "Accept failed");
    }
  }, [activeCall?.id, activeCall?.callInviteId, activeCall?.roomUrl, myId, updateCallState]);

  const handleDecline = useCallback(async () => {
    try {
      const callId = activeCall?.id ?? activeCall?.callInviteId;
      if (!myId || !callId) return;

      await supabase
        .from("call_invites")
        .update({ status: "declined" })
        .eq("id", callId)
        .eq("callee_id", myId)
        .eq("status", "ringing");

      updateCallState({ callState: "declined" });
    } catch (e: any) {
      console.error("[AudioCall] decline exception", e);
    } finally {
      await endCall();
    }
  }, [activeCall?.id, activeCall?.callInviteId, myId, updateCallState, endCall]);

  if (!activeCall || activeCall.callType !== "audio") return null;

  const isIncoming = activeCall.callState === "incoming" || activeCall.callState === "ringing";

  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
          <User className="h-12 w-12 text-gray-500" />
        </div>

        <h2 className="text-white text-2xl font-semibold">{activeCall.otherUserName || "Incoming call"}</h2>
        <p className="text-white/60 text-sm">Incoming audio call</p>

        <div className="flex items-center gap-4 mt-2">
          <Button onClick={handleDecline} variant="destructive" className="rounded-full px-6 h-12 bg-red-600 hover:bg-red-700">
            Decline
          </Button>
          <Button onClick={handleAccept} className="rounded-full px-6 h-12">
            Accept
          </Button>
        </div>
      </div>
    );
  }

  if (activeCall.callState === "declined" || activeCall.callState === "no-answer") {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
          <User className="h-12 w-12 text-gray-500" />
        </div>
        <h2 className="text-white text-2xl font-semibold">{activeCall.otherUserName}</h2>
        <p className="text-white/60">{activeCall.callState === "declined" ? "Call declined" : "No answer"}</p>
        <Button onClick={() => void endCall()} variant="secondary" className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <AudioCallWrapper
        roomUrl={activeCall.roomUrl}
        otherUserName={activeCall.otherUserName}
        onLeave={() => void handleLeave()}
        onParticipantJoined={handleParticipantJoined}
      />

      {(activeCall.callState === "calling" || activeCall.callState === "ringing") && (
        <div className="absolute inset-0 z-10">
          <CallingScreen
            otherUserName={activeCall.otherUserName || "Unknown"}
            callType="audio"
            onCancel={() => void handleLeave()}
          />
        </div>
      )}
    </div>
  );
};

export default AudioCallScreen;