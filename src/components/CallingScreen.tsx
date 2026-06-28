// src/components/callingScreen.tsx
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Phone, PhoneOff, Video, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CallingScreenProps {
  /**
   * When false, renders nothing and never starts audio.
   * This prevents accidental full-screen overlays.
   */
  open?: boolean;
  otherUserName: string;
  otherUserAvatar?: string;
  callType: "video" | "audio";
  onCancel: () => void;
}

// Outgoing dial tone using Web Audio API (best-effort, safe cleanup)
function createDialTone() {
  let audioContext: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gain: GainNode | null = null;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeouts: ReturnType<typeof setTimeout>[] = [];

  const clearAllTimeouts = () => {
    for (const t of timeouts) clearTimeout(t);
    timeouts = [];
  };

  const stopOsc = () => {
    if (osc1) {
      try {
        osc1.stop();
      } catch {}
      try {
        osc1.disconnect();
      } catch {}
      osc1 = null;
    }
    if (osc2) {
      try {
        osc2.stop();
      } catch {}
      try {
        osc2.disconnect();
      } catch {}
      osc2 = null;
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {}
      gain = null;
    }
  };

  const ensureContext = async () => {
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {}
    }
    return audioContext;
  };

  const playBurst = async () => {
    try {
      const ctx = await ensureContext();

      stopOsc(); // no overlap

      gain = ctx.createGain();
      gain.gain.value = 0.0; // fade in quickly to avoid click

      osc1 = ctx.createOscillator();
      osc2 = ctx.createOscillator();

      osc1.type = "sine";
      osc2.type = "sine";

      // US dial tone: 440 + 480
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      // quick fade-in
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.03);

      // 2s on, then fade out and stop
      timeouts.push(
        setTimeout(() => {
          try {
            if (!audioContext || !gain) return;
            const t = audioContext.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.05);
          } catch {}
        }, 2000)
      );

      timeouts.push(
        setTimeout(() => {
          stopOsc();
        }, 2100)
      );
    } catch (e) {
      console.warn("[CallingScreen] dial tone failed:", e);
    }
  };

  const start = () => {
    void playBurst();
    intervalId = setInterval(() => void playBurst(), 6000); // 2s on + 4s off
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    clearAllTimeouts();
    stopOsc();

    if (audioContext) {
      try {
        audioContext.close();
      } catch {}
      audioContext = null;
    }
  };

  return { start, stop };
}

export default function CallingScreen({
  open = false,
  otherUserName,
  otherUserAvatar,
  callType,
  onCancel,
}: CallingScreenProps) {
  const toneRef = useRef<ReturnType<typeof createDialTone> | null>(null);

  const displayName = useMemo(() => {
    const n = (otherUserName || "").trim();
    return n || "User";
  }, [otherUserName]);

  const stopTone = useCallback(() => {
    if (toneRef.current) {
      toneRef.current.stop();
      toneRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopTone();
      return;
    }

    // Best-effort: some platforms require a user gesture; still safe if it fails.
    toneRef.current = createDialTone();
    toneRef.current.start();

    const onVisibility = () => {
      if (document.hidden) stopTone();
    };

    const onPageHide = () => {
      stopTone();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stopTone();
    };
  }, [open, stopTone]);

  const handleCancel = useCallback(() => {
    stopTone();
    onCancel();
  }, [onCancel, stopTone]);

  // If not open, render nothing so it cannot block UI
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Calling screen"
    >
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-gray-900 to-black border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2 text-white/70">
            {callType === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
            <span className="text-xs uppercase tracking-wider">
              {callType === "video" ? "Outgoing video call" : "Outgoing audio call"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <Avatar className="h-28 w-28 border-4 border-white/15">
              <AvatarImage src={otherUserAvatar || ""} alt={displayName} />
              <AvatarFallback className="text-3xl bg-gray-700 text-white">
                {displayName.charAt(0)?.toUpperCase() || <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h2 className="text-white text-2xl font-semibold">{displayName}</h2>
            <div className="mt-2 flex items-center justify-center gap-1 text-white/70">
              <span>Calling</span>
              <span className="inline-flex">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                  .
                </span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                  .
                </span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                  .
                </span>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              size="lg"
              onClick={handleCancel}
              className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <div className="mt-3 text-center text-white/60 text-sm">Cancel</div>
          </div>
        </div>
      </div>
    </div>
  );
}