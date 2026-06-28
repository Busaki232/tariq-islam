// src/hooks/useAudioPlayer.ts
import { useCallback, useEffect, useRef, useState } from "react";

type AudioPlayerState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lastError: string | null;
  togglePlayPause: () => Promise<void>;
  seek: (time: number) => void;
  stop: () => void;
};

function canPlayMime(mime: string): boolean {
  const el = document.createElement("audio");
  const res = el.canPlayType(mime);
  return res === "probably" || res === "maybe";
}

async function tryHeadContentType(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.headers.get("content-type");
  } catch {
    return null;
  }
}

function normalizeContentType(ct: string | null): string | null {
  if (!ct) return null;
  return ct.split(";")[0].trim().toLowerCase();
}

export const useAudioPlayer = (audioUrl: string): AudioPlayerState => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const prev = audioRef.current;
    if (prev) {
      try {
        prev.pause();
      } catch {
        // ignore
      }
      prev.src = "";
      prev.load();
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLastError(null);

    const url = (audioUrl || "").trim();
    if (!url) {
      audioRef.current = null;
      return;
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.src = url;
    audioRef.current = audio;

    let cancelled = false;

    // Optional: best-effort check of response Content-Type (helps a lot for proxy URLs)
    (async () => {
      const ctRaw = await tryHeadContentType(url);
      if (cancelled) return;

      const ct = normalizeContentType(ctRaw);

      // If your proxy returns text/html or application/json, iOS will fail with "not supported"
      // This gives you a friendly message BEFORE user taps play.
      if (ct) {
        const playable = ct.startsWith("audio/") ? canPlayMime(ct) : false;

        if (!ct.startsWith("audio/")) {
          setLastError("Audio source did not return an audio file.");
        } else if (!playable) {
          setLastError("This audio format is not supported on this device.");
        }
      }
    })();

    const onLoadedMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);

      const mediaErr = audio.error;
      const code = mediaErr?.code;

      // More specific messages help you debug
      if (code === 2) {
        setLastError("Network error while loading audio.");
      } else if (code === 3) {
        setLastError("Audio decoding failed.");
      } else if (code === 4) {
        setLastError("This audio format is not supported on this device.");
      } else {
        setLastError("Audio failed to load.");
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      cancelled = true;

      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);

      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.src = "";
      audio.load();

      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [audioUrl]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }

    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      setLastError("Audio is unavailable.");
      return;
    }

    setLastError(null);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      setIsPlaying(false);

      // Safari often rejects play() if not from a direct user gesture
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("NotAllowedError")) {
        setLastError("Tap play to start audio.");
      } else {
        setLastError("Playback failed on this device.");
      }
    }
  }, [isPlaying]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const safe = Math.max(0, Math.min(time, Number.isFinite(duration) ? duration : time));
      try {
        audio.currentTime = safe;
      } catch {
        // ignore
      }
      setCurrentTime(safe);
    },
    [duration]
  );

  return { isPlaying, currentTime, duration, lastError, togglePlayPause, seek, stop };
};