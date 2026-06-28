// src/components/VideoCallScreen.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  DailyProvider,
  useDaily,
  useDailyEvent,
  useLocalSessionId,
  useParticipantIds,
  DailyVideo,
  DailyAudio,
} from "@daily-co/daily-react";

import { useActiveCall } from "@/hooks/useActiveCall";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, VideoOff, Video, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import CallingScreen from "@/components/CallingScreen";

type CallType = "video" | "audio";

interface CallContentProps {
  callType: CallType;
  otherUserName?: string;
  onLeave: () => void;
  onParticipantJoined: () => void;
}

type PluginListenerHandleLike = { remove?: () => void } | null;

const CallContent = ({ callType, otherUserName, onLeave, onParticipantJoined }: CallContentProps) => {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const participantIds = useParticipantIds({ filter: "remote" });
  const { t } = useTranslation("common");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType !== "video");
  const [callDuration, setCallDuration] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const hasNotifiedParticipantJoined = useRef(false);

  useDailyEvent(
    "joined-meeting",
    useCallback(() => {
      setIsJoined(true);
      setIsJoining(false);
      setIsReconnecting(false);

      if (callType === "video") {
        setIsCameraOff(false);
      }
    }, [callType])
  );

  useDailyEvent(
    "left-meeting",
    useCallback(() => {
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
    useCallback(
      (event: any) => {
        console.error("[VideoCall] Daily error:", event);
        setIsJoining(false);
        setIsReconnecting(false);
        toast.error(t("call.errorTitle", { defaultValue: "Call error" }), {
          description: event?.errorMsg || t("call.errorBody", { defaultValue: "There was an issue with the call" }),
        });
      },
      [t]
    )
  );

  useEffect(() => {
    if (!daily) return;
    try {
      daily.setLocalAudio(!isMuted);
    } catch {}
  }, [daily, isMuted]);

  useEffect(() => {
    if (!daily) return;
    try {
      daily.setLocalVideo(!isCameraOff);
    } catch {}
  }, [daily, isCameraOff]);

  useEffect(() => {
    if (!isJoined) return;
    const timer = window.setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isJoined]);

  useEffect(() => {
    if (participantIds.length > 0 && !hasNotifiedParticipantJoined.current) {
      hasNotifiedParticipantJoined.current = true;
      onParticipantJoined();
    }
  }, [participantIds, onParticipantJoined]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cap = (window as any)?.Capacitor;
    const StatusBar = cap?.Plugins?.StatusBar;
    if (!StatusBar) return;

    void (async () => {
      try {
        if (typeof StatusBar.setOverlaysWebView === "function") {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch {}
      try {
        if (typeof StatusBar.hide === "function") {
          await StatusBar.hide();
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleRef = { current: null as PluginListenerHandleLike };
    let cancelled = false;

    const attach = async () => {
      try {
        const maybe = App.addListener("backButton", () => {
          // Do nothing. Must hang up via UI.
        });

        const handle: any = typeof (maybe as any)?.then === "function" ? await (maybe as any) : maybe;

        if (cancelled) {
          if (handle?.remove && typeof handle.remove === "function") {
            try {
              handle.remove();
            } catch {}
          }
          return;
        }

        handleRef.current = handle;
      } catch (err) {
        console.warn("[VideoCall] backButton listener failed:", err);
      }
    };

    void attach();

    return () => {
      cancelled = true;
      const h = handleRef.current as any;
      if (h?.remove && typeof h.remove === "function") {
        try {
          h.remove();
        } catch {}
      }
      handleRef.current = null;
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    try {
      daily?.setLocalAudio(!next);
    } catch {}
    setIsMuted(next);
  }, [daily, isMuted]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraOff;
    try {
      daily?.setLocalVideo(!next);
    } catch {}
    setIsCameraOff(next);
  }, [daily, isCameraOff]);

  const handleLeave = useCallback(() => {
    try {
      daily?.setLocalAudio(false);
      daily?.setLocalVideo(false);
    } catch {}
    daily?.leave().catch(() => {});
    onLeave();
  }, [daily, onLeave]);

  const hasRemoteParticipants = participantIds.length > 0;
  const showLocalPreview = Boolean(localSessionId && isJoined);

  return (
    <>
      <DailyAudio maxSpeakers={8} />

      {(isJoining || isReconnecting) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-white text-lg">
              {isReconnecting
                ? t("call.reconnecting", { defaultValue: "Reconnecting..." })
                : t("call.connecting", { defaultValue: "Connecting..." })}
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-20">
        <div className="flex items-center gap-2 text-white bg-black/60 px-3 py-1.5 rounded-full">
          <User className="h-4 w-4" />
          <span className="text-sm">{participantIds.length + 1}</span>
        </div>
        <div className="text-white font-mono bg-black/60 px-3 py-1.5 rounded-full text-sm">
          {formatDuration(callDuration)}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {hasRemoteParticipants ? (
          <DailyVideo
            sessionId={participantIds[0]}
            type="video"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center">
              <User className="h-16 w-16 text-gray-500" />
            </div>
            <p className="text-xl font-semibold">
              {otherUserName || t("call.unknownUser", { defaultValue: "Unknown" })}
            </p>
            <p className="text-white/60 text-sm">
              {t("call.waitingJoin", { defaultValue: "Waiting for them to join…" })}
            </p>
          </div>
        )}
      </div>

      {showLocalPreview && localSessionId && (
        <div className="absolute bottom-28 right-4 w-28 h-40 rounded-xl overflow-hidden shadow-lg border-2 border-white/20 z-20 bg-black">
          {!isCameraOff ? (
            <DailyVideo
              sessionId={localSessionId}
              type="video"
              automirror
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <VideoOff className="h-8 w-8 text-gray-500" />
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-6 z-20">
        <Button
          variant="outline"
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isMuted ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/10 border-white/20 text-white"
          }`}
          onClick={toggleMute}
          aria-label={t("call.toggleMic", { defaultValue: "Toggle microphone" })}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isCameraOff ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/10 border-white/20 text-white"
          }`}
          onClick={toggleCamera}
          aria-label={t("call.toggleCam", { defaultValue: "Toggle camera" })}
        >
          {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
          onClick={handleLeave}
          aria-label={t("call.hangUp", { defaultValue: "Hang up" })}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
};

const GLOBAL_DAILY_CO_KEY = "__TI_DAILY_CALL_OBJECT__";

function getGlobalCallObject(): DailyCall | null {
  return ((globalThis as any)[GLOBAL_DAILY_CO_KEY] as DailyCall | null) ?? null;
}

function setGlobalCallObject(co: DailyCall | null) {
  (globalThis as any)[GLOBAL_DAILY_CO_KEY] = co;
}

const VideoCallWrapper = ({
  roomUrl,
  callType,
  otherUserName,
  onLeave,
  onParticipantJoined,
}: {
  roomUrl: string;
  callType: CallType;
  otherUserName?: string;
  onLeave: () => void;
  onParticipantJoined: () => void;
}) => {
  const { t } = useTranslation("common");

  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callObjectRef = useRef<DailyCall | null>(null);
  const joinedRef = useRef(false);
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
    joinedRef.current = false;
    startingRef.current = false;

    const co = callObjectRef.current;
    callObjectRef.current = null;

    const globalCo = getGlobalCallObject();
    if (globalCo && globalCo === co) setGlobalCallObject(null);

    if (co) {
      try {
        try {
          co.setLocalAudio(false);
          co.setLocalVideo(false);
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

      const existing = getGlobalCallObject();
      if (existing) {
        try {
          existing.setLocalAudio(false);
          existing.setLocalVideo(false);
        } catch {}
        try {
          await existing.leave();
        } catch {}
        try {
          await existing.destroy();
        } catch {}
        setGlobalCallObject(null);
      }

      await teardown();

      try {
        const { ensureMediaPermissions } = await import("@/utils/permissions");
        const ok = await ensureMediaPermissions(callType);
        if (!ok) {
          setError(
            t("call.permissionsRequired", {
              defaultValue: "Camera/microphone access required. Please allow access in settings.",
            })
          );
          return;
        }

        if (cancelled) return;

        const co = DailyIframe.createCallObject({
          startAudioOff: false,
          startVideoOff: callType !== "video",
        });

        const onCameraError = (e: any) => console.log("[VideoCall] camera-error", e);
        const onDailyError = (e: any) => console.log("[VideoCall] daily-error", e);

        co.on("camera-error", onCameraError);
        co.on("error", onDailyError);

        setGlobalCallObject(co);
        callObjectRef.current = co;
        setCallObject(co);

        co.once("joined-meeting", () => {
          joinedRef.current = true;
          clearJoinTimeout();
        });

        co.once("left-meeting", () => {
          joinedRef.current = false;
        });

        co.once("participant-joined", () => {
          try {
            onParticipantJoined();
          } catch {}
        });

        try {
          await (co as any).startCamera({
            audioSource: true,
            videoSource: callType === "video",
          });
          console.log("[VideoCall] startCamera ok");
        } catch (e) {
          console.log("[VideoCall] startCamera failed", e);
        }

        timeoutRef.current = setTimeout(() => {
          if (!joinedRef.current && !cancelled) {
            setError(
              t("call.joinTimeout", {
                defaultValue: "Join timed out",
              })
            );
            void teardown();
          }
        }, 20000);

        console.log("[VideoCall] joining roomUrl =", roomUrl);
        await co.join({ url: roomUrl });

        if (cancelled) {
          try {
            co.off?.("camera-error", onCameraError);
            co.off?.("error", onDailyError);
          } catch {}
          await teardown();
          return;
        }

        try {
          co.setLocalAudio(true);
          co.setLocalVideo(callType === "video");
          console.log("[VideoCall] forced publish after join");
        } catch (e) {
          console.log("[VideoCall] force publish failed", e);
        }
      } catch (err) {
        console.error("[VideoCall] start error:", err);
        if (!cancelled) {
          setError(
            t("call.errorBody", {
              defaultValue: "There was an issue starting the call.",
            })
          );
          void teardown();
        }
      } finally {
        if (!cancelled) startingRef.current = false;
      }
    };

    void startOnce();

    return () => {
      cancelled = true;
      void teardown();
    };
  }, [roomUrl, callType, t, teardown, clearJoinTimeout, onParticipantJoined]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-white text-lg">{error}</p>
          <Button
            onClick={() => {
              void teardown().finally(() => onLeave());
            }}
            variant="secondary"
          >
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </div>
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-white text-lg">{t("call.initializing", { defaultValue: "Initializing call..." })}</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <CallContent
        callType={callType}
        otherUserName={otherUserName}
        onLeave={onLeave}
        onParticipantJoined={onParticipantJoined}
      />
    </DailyProvider>
  );
};

export const VideoCallScreen = () => {
  const { activeCall, endCall, updateCallState } = useActiveCall();
  const { t } = useTranslation("common");

  const [showMissed, setShowMissed] = useState(false);
  const leavingRef = useRef(false);
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
      missedTimerRef.current = null;
    };
  }, []);

  if (!activeCall || activeCall.callType !== "video") return null;

  const roomUrl = activeCall.roomUrl;
  if (!roomUrl) return null;

  const inviteId = (activeCall as any)?.id ?? (activeCall as any)?.callInviteId ?? null;
  const callState = activeCall.callState;

  const handleParticipantJoined = useCallback(() => {
    updateCallState({ callState: "connected" });
  }, [updateCallState]);

  const leave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
    missedTimerRef.current = null;

    if (inviteId) {
      try {
        const wasDialing = callState === "calling" || callState === "waiting" || callState === "ringing";

        if (wasDialing) {
          await supabase
            .from("call_invites")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", inviteId)
            .eq("status", "ringing");
        } else {
          await supabase
            .from("call_invites")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", inviteId)
            .neq("status", "ended");
        }
      } catch {}
    }

    await endCall();
  }, [inviteId, endCall, callState]);

  const handleRemoteStatus = useCallback(
    (nextStatus: string | null | undefined) => {
      if (!nextStatus) return;
      if (leavingRef.current) return;

      if (nextStatus === "accepted") {
        updateCallState({ callState: "connected" });
        return;
      }

      if (nextStatus === "declined") {
        toast.error(t("call.declined", { defaultValue: "Call declined" }));
        void leave();
        return;
      }

      if (nextStatus === "ended") {
        const wasDialing = callState === "calling" || callState === "waiting" || callState === "ringing";

        if (wasDialing) {
          updateCallState({ callState: "no-answer" as any });
          setShowMissed(true);

          missedTimerRef.current = setTimeout(() => {
            void leave();
          }, 1600);
          return;
        }

        toast.error(t("call.ended", { defaultValue: "Call ended" }));
        void leave();
      }
    },
    [callState, leave, t, updateCallState]
  );

  useEffect(() => {
    if (!inviteId) return;

    let stopped = false;

    const channel = supabase
      .channel(`call_invite_watch:${inviteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_invites", filter: `id=eq.${inviteId}` },
        (payload: any) => {
          if (stopped) return;
          const nextStatus = payload?.new?.status as string | undefined;
          console.log("[VideoCall] invite status update:", nextStatus);
          handleRemoteStatus(nextStatus);
        }
      )
      .subscribe();

    const poll = async () => {
      try {
        const { data } = await supabase.from("call_invites").select("status").eq("id", inviteId).maybeSingle();
        const st = (data as any)?.status as string | undefined;
        if (!stopped) handleRemoteStatus(st);
      } catch {}
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [inviteId, handleRemoteStatus]);

  const showDialUi = callState === "calling" || callState === "waiting" || callState === "ringing";

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <VideoCallWrapper
        roomUrl={roomUrl}
        callType="video"
        otherUserName={activeCall.otherUserName}
        onLeave={() => void leave()}
        onParticipantJoined={handleParticipantJoined}
      />

      {showDialUi && (
        <CallingScreen
          otherUserName={activeCall.otherUserName || t("call.user", { defaultValue: "User" })}
          otherUserAvatar={undefined}
          callType="video"
          onCancel={() => void leave()}
        />
      )}

      {showMissed && (
        <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/70">
          <div className="rounded-2xl border border-white/10 bg-black/80 px-6 py-5 text-center">
            <div className="text-white text-xl font-semibold">
              {t("call.missedTitle", { defaultValue: "Missed call" })}
            </div>
            <div className="mt-1 text-white/60 text-sm">
              {(activeCall.otherUserName || t("call.user", { defaultValue: "User" }))}{" "}
              {t("call.noAnswer", { defaultValue: "didn’t answer" })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallScreen;