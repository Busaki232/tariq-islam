// src/components/IncomingCallScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, Video, X, PhoneCall, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useIncomingCall } from "@/hooks/useIncomingCall";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Incoming ringtone using Web Audio (works in many Android WebViews).
 * Also supports vibration as a fallback (after user gesture).
 */
function createIncomingRingtone() {
  let audioContext: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let ringTimeout1: ReturnType<typeof setTimeout> | null = null;
  let ringTimeout2: ReturnType<typeof setTimeout> | null = null;

  const cleanupOscillators = () => {
    if (ringTimeout1) clearTimeout(ringTimeout1);
    if (ringTimeout2) clearTimeout(ringTimeout2);
    ringTimeout1 = null;
    ringTimeout2 = null;

    if (osc1) {
      try {
        osc1.stop();
      } catch {}
      osc1 = null;
    }
    if (osc2) {
      try {
        osc2.stop();
      } catch {}
      osc2 = null;
    }
  };

  const playRingBurst = async () => {
    try {
      if (!audioContext) audioContext = new AudioContext();

      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch {}
      }

      cleanupOscillators();

      osc1 = audioContext.createOscillator();
      osc2 = audioContext.createOscillator();
      gain = audioContext.createGain();

      osc1.type = "sine";
      osc2.type = "sine";

      // Classic-ish ring pair
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      gain.gain.value = 0.18;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioContext.destination);

      osc1.start();
      osc2.start();

      // Ring pattern: ~2s on, then off
      ringTimeout1 = setTimeout(() => {
        if (gain) gain.gain.value = 0;
      }, 2000);

      ringTimeout2 = setTimeout(() => {
        cleanupOscillators();
      }, 2100);
    } catch (e) {
      // Autoplay restrictions can block this until user taps
      console.warn("[IncomingCall] ringtone play failed:", e);
    }
  };

  const start = () => {
    void playRingBurst();
    intervalId = setInterval(() => void playRingBurst(), 6000); // 2s on + 4s off
  };

  const stop = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    cleanupOscillators();

    if (audioContext) {
      try {
        audioContext.close();
      } catch {}
      audioContext = null;
    }

    gain = null;

    try {
      if ("vibrate" in navigator) navigator.vibrate(0);
    } catch {}
  };

  return { start, stop };
}

export const IncomingCallScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { invite, callerName, loading, accept, decline, clear } = useIncomingCall();

  const isVisible = !loading && !!invite && invite.status === "ringing";

  // UX state: prevent double tap + show smooth "Connecting..."
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Protect against re-entrancy
  const actionLockRef = useRef<"accept" | "decline" | null>(null);

  // Track the invite we’re currently displaying so we can reset UI if a new invite arrives
  const inviteId = invite?.id ?? null;
  const inviteIdRef = useRef<string | null>(null);

  const derived = useMemo(() => {
    const safeCallerName = (callerName || "Unknown").trim() || "Unknown";
    const callType = ((invite as any)?.call_type || "audio") as "video" | "audio";

    const callerAvatar =
      ((invite as any)?.callerAvatar as string | undefined) ||
      ((invite as any)?.caller_avatar as string | undefined) ||
      undefined;

    const initials =
      safeCallerName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join("") || "?";

    return { safeCallerName, callType, callerAvatar, initials };
  }, [callerName, invite]);

  // Ringtone and vibration controller
  const ringRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const ringingInviteIdRef = useRef<string | null>(null);
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Android WebView needs a user gesture before vibrate/audio can work reliably
  const userGestureRef = useRef(false);
  const markUserGesture = useCallback(() => {
    userGestureRef.current = true;
  }, []);

  // Capture first gesture globally (so vibration can start after the user touches the screen)
  useEffect(() => {
    const onGesture = () => {
      userGestureRef.current = true;
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("touchstart", onGesture, true);
      window.removeEventListener("mousedown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    };

    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("touchstart", onGesture, true);
    window.addEventListener("mousedown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);

    return () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("touchstart", onGesture, true);
      window.removeEventListener("mousedown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    };
  }, []);

  const stopRinging = useCallback(() => {
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (ringRef.current) {
      ringRef.current.stop();
      ringRef.current = null;
    }
    ringingInviteIdRef.current = null;
  }, []);

  // If a new invite shows up, reset UI locks so Accept works smoothly
  useEffect(() => {
    if (!inviteId) {
      inviteIdRef.current = null;
      actionLockRef.current = null;
      setAccepting(false);
      setDeclining(false);
      return;
    }

    if (inviteIdRef.current !== inviteId) {
      inviteIdRef.current = inviteId;
      actionLockRef.current = null;
      setAccepting(false);
      setDeclining(false);
    }
  }, [inviteId]);

  useEffect(() => {
    // Start ringing only when visible and invite changes
    const id = invite?.id ?? null;

    if (!isVisible || !id) {
      stopRinging();
      return;
    }

    if (ringingInviteIdRef.current === id) return;

    stopRinging();
    ringingInviteIdRef.current = id;

    ringRef.current = createIncomingRingtone();
    ringRef.current.start();

    // Vibration fallback: only after a user gesture (Android WebView restriction)
    const startVibrationIfAllowed = () => {
      if (!userGestureRef.current) return;

      try {
        if ("vibrate" in navigator) {
          navigator.vibrate([250, 150, 250]);

          if (vibrateIntervalRef.current) clearInterval(vibrateIntervalRef.current);
          vibrateIntervalRef.current = setInterval(() => {
            try {
              navigator.vibrate([250, 150, 250]);
            } catch {}
          }, 2000);
        }
      } catch {}
    };

    // Try immediately (works if user already interacted with app UI)
    startVibrationIfAllowed();

    // Also try again on the very next tap on this screen
    const onFirstTap = () => {
      startVibrationIfAllowed();
      document.removeEventListener("pointerdown", onFirstTap, true);
      document.removeEventListener("touchstart", onFirstTap, true);
    };
    document.addEventListener("pointerdown", onFirstTap, true);
    document.addEventListener("touchstart", onFirstTap, true);

    // Stop if app goes background
    const onVisibility = () => {
      if (document.hidden) stopRinging();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onFirstTap, true);
      document.removeEventListener("touchstart", onFirstTap, true);
      stopRinging();
    };
  }, [isVisible, invite?.id, stopRinging]);

  const declineCall = useCallback(async () => {
    if (!invite) return;
    if (actionLockRef.current) return;

    actionLockRef.current = "decline";
    setDeclining(true);
    stopRinging();

    try {
      await decline(invite.id);
    } catch (e: any) {
      console.error("[IncomingCallScreen] decline failed", e);
      toast.error("Decline failed", { description: e?.message || "Unknown error" });
    } finally {
      try {
        clear();
      } catch {}
      setDeclining(false);
      actionLockRef.current = null;
    }
  }, [invite, decline, clear, stopRinging]);

  const answerCall = useCallback(async () => {
    if (!invite) return;
    if (actionLockRef.current) return;

    // mark gesture early (helps WebView unlock restrictions)
    markUserGesture();

    actionLockRef.current = "accept";
    setAccepting(true);
    stopRinging();

    try {
      const res = await accept(invite.id);

      if (!res?.roomUrl || !res?.callType || !res?.inviteId) {
        toast.error("Unable to connect", { description: "Missing room info" });
        setAccepting(false);
        actionLockRef.current = null;
        return;
      }

      toast.success("Connecting...");

      const sp = new URLSearchParams();
      sp.set("callType", String(res.callType));
      sp.set("roomUrl", String(res.roomUrl));
      sp.set("inviteId", String(res.inviteId));

      if (res.conversationId) sp.set("conversationId", String(res.conversationId));
      if (res.callerId) sp.set("callerId", String(res.callerId));
      sp.set("callerName", String(callerName || "Caller"));

      navigate(`/call?${sp.toString()}`, {
        replace: true,
        state: { from: location.pathname },
      });

      try {
        clear();
      } catch {}
    } catch (e: any) {
      console.error("[IncomingCallScreen] accept failed", e);
      toast.error("Accept failed", { description: e?.message || "Unknown error" });
      setAccepting(false);
      actionLockRef.current = null;
    }
  }, [invite, accept, navigate, callerName, stopRinging, clear, location.pathname, markUserGesture]);

  if (!isVisible) return null;

  const CallIcon = derived.callType === "video" ? Video : Phone;
  const disableActions = accepting || declining;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/95 to-black/95 shadow-2xl">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70 flex items-center gap-2">
                <CallIcon className="h-4 w-4" />
                <span>Incoming {derived.callType} call</span>
              </div>

              <button
                type="button"
                onPointerDown={markUserGesture}
                onClick={declineCall}
                disabled={disableActions}
                className="inline-flex items-center justify-center rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-primary/15 animate-pulse" />
                <Avatar className="h-24 w-24 border border-white/15">
                  <AvatarImage src={derived.callerAvatar || ""} alt={derived.safeCallerName} />
                  <AvatarFallback className="text-2xl bg-white/10 text-white">
                    {derived.initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              <h1 className="mt-4 text-2xl font-semibold text-white leading-tight">
                {derived.safeCallerName}
              </h1>

              <p className="mt-1 text-sm text-white/60">
                {accepting ? "Connecting..." : "Tap accept to join the call"}
              </p>
            </div>
          </div>

          <div className="p-6 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onPointerDown={markUserGesture}
                onClick={declineCall}
                disabled={disableActions}
                className="h-12 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 active:scale-[0.99] transition disabled:opacity-50 disabled:active:scale-100"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {declining ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
                  {declining ? "Declining..." : "Decline"}
                </span>
              </button>

              <button
                type="button"
                onPointerDown={markUserGesture}
                onClick={answerCall}
                disabled={disableActions}
                className="h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 active:scale-[0.99] transition disabled:opacity-60 disabled:active:scale-100"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />}
                  {accepting ? "Connecting..." : "Accept"}
                </span>
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-white/50">
              It should disappear instantly after you accept or decline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallScreen