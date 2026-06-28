// src/components/VideoCallEmbed.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";

type Props = {
  roomUrl: string;
  userName: string;
  isAudioOnly?: boolean;
  onLeave?: () => void | Promise<void>;
};

export default function VideoCallEmbed({ roomUrl, userName, isAudioOnly = false, onLeave }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [embedReady, setEmbedReady] = useState(false);
  const joinSentRef = useRef(false);

  const payload = useMemo(
    () => ({
      action: "join",
      roomUrl,
      userName,
      audioOnly: !!isAudioOnly,
    }),
    [roomUrl, userName, isAudioOnly]
  );
async function ensurePermissions() {
  // On native, request camera permission via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      await Camera.requestPermissions({
        permissions: ["camera"],
      });
    } catch (e) {
      console.warn("[VideoCallEmbed] Camera permission request failed:", e);
    }
  }

  // Also request media via getUserMedia to trigger mic permission on all platforms
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    // Immediately stop - we just needed to request permission
    stream.getTracks().forEach(track => track.stop());
    console.log("[VideoCallEmbed] Media permissions granted");
  } catch (e) {
    console.warn("[VideoCallEmbed] getUserMedia failed:", e);
  }
}
  useEffect(() => {
    joinSentRef.current = false;
    setEmbedReady(false);

    const onMsg = (ev: MessageEvent) => {
      const d: any = ev.data;
      if (!d) return;

      if (d.type === "DAILY_EMBED_READY") {
        setEmbedReady(true);
      }

      // Useful debugging (optional)
      if (d.type?.startsWith("DAILY_")) {
        // eslint-disable-next-line no-console
        console.log("[DailyEmbed]", d);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [roomUrl]);

useEffect(() => {
  if (!embedReady) return;

  const iframe = iframeRef.current;
  const cw = iframe?.contentWindow;
  if (!cw) return;

  if (joinSentRef.current) return;
  joinSentRef.current = true;

  (async () => {
    try {
      await ensurePermissions(); // ✅ Android camera + mic permission

      cw.postMessage(payload, "*");
      // eslint-disable-next-line no-console
      console.log("[Daily] join posted after READY");
    } catch (e) {
      joinSentRef.current = false;
      // eslint-disable-next-line no-console
      console.error("[Daily] postMessage failed:", e);
    }
  })();
}, [embedReady, payload]);

  useEffect(() => {
    return () => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ action: "leave" }, "*");
      } catch {}
      Promise.resolve(onLeave?.()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="/daily-embed.html"
      allow="camera; microphone; fullscreen; autoplay"
      className="absolute inset-0 w-full h-full border-none"
      title="Daily Call"
    />
  );
}
