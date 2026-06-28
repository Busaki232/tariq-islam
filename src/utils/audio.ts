// src/utils/audio.ts

function isiOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS can report as Mac, so also check touch points
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
  return isAppleMobile || isIPadOS13Plus;
}

export function pickAudioMime() {
  // If MediaRecorder is not available, caller should handle fallback recording method
  // (or return "" so the recorder uses browser defaults).
  // @ts-ignore
  const MR = typeof window !== "undefined" ? window.MediaRecorder : undefined;
  if (!MR || typeof MR.isTypeSupported !== "function") return "";

  // iOS Safari is happiest when we *try* mp4 first.
  // Many iOS builds won't support MediaRecorder at all; this function returns "" in that case.
  const candidates = isiOS()
    ? [
        "audio/mp4",
        "audio/aac",
        "audio/webm;codecs=opus",
        "audio/webm",
      ]
    : [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];

  for (const c of candidates) {
    try {
      if (MR.isTypeSupported(c)) return c;
    } catch {
      // ignore
    }
  }

  // Last resort: let browser pick default when creating MediaRecorder(stream, {})
  return "";
}