// src/components/VoiceMessagePlayer.tsx
import { useEffect, useMemo, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { AudioWaveform } from "./AudioWaveform";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  className?: string;
}

const ATTACHMENTS_BUCKET = "message-attachments";

// Module-level cache so it survives rerenders and multiple instances
const missingKeys = new Set<string>();
const signedCache = new Map<string, { url: string; expiresAt: number }>();

const MISSING_KEYS_SESSION_KEY = "voice_missing_keys_v1";

function loadMissingKeysFromSession() {
  try {
    const raw = sessionStorage.getItem(MISSING_KEYS_SESSION_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const k of arr) {
        if (typeof k === "string" && k) missingKeys.add(k);
      }
    }
  } catch {
    // ignore
  }
}

function saveMissingKeysToSession() {
  try {
    sessionStorage.setItem(MISSING_KEYS_SESSION_KEY, JSON.stringify(Array.from(missingKeys)));
  } catch {
    // ignore
  }
}

// load once
loadMissingKeysFromSession();

function stripQuery(u: string) {
  const i = u.indexOf("?");
  return i >= 0 ? u.slice(0, i) : u;
}

function isTempPath(raw: string | null | undefined) {
  if (!raw) return false;
  const s = String(raw);
  return s.includes("/temp-") || s.includes("thumbs/temp-") || s.startsWith("temp-");
}

function isSignedSupabaseUrl(u: string) {
  return u.includes("/storage/v1/object/sign/") || u.includes("token=");
}

function isPublicSupabaseUrl(u: string) {
  return u.includes("/storage/v1/object/public/");
}

/**
 * Convert whatever is stored (plain key, public URL, signed URL)
 * into a storage key (path inside bucket).
 */
function toStoragePath(raw: string | null | undefined, bucket: string): string | null {
  if (!raw) return null;

  // Plain key
  if (!raw.startsWith("http")) {
    const cleaned = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");
    if (!cleaned) return null;

    // If someone stored "message-attachments/<key>", strip it
    const prefix = `${bucket}/`;
    if (cleaned.startsWith(prefix)) return cleaned.slice(prefix.length) || null;

    return cleaned;
  }

  try {
    const u = new URL(raw);

    // /storage/v1/object/public/<bucket>/<key>
    // /storage/v1/object/sign/<bucket>/<key>
    const marker = `/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;

    const key = u.pathname.slice(idx + marker.length);
    const cleaned = key.split("?")[0].split("#")[0].replace(/^\/+/, "");
    return cleaned || null;
  } catch {
    return null;
  }
}

function isObjectNotFound(err: any) {
  const msg = String(err?.message || err?.error || "");
  const status = err?.statusCode ?? err?.status ?? err?.cause?.status;
  return msg.toLowerCase().includes("object not found") || msg.toLowerCase().includes("not_found") || status === 404;
}

export const VoiceMessagePlayer = ({ audioUrl, duration, className }: VoiceMessagePlayerProps) => {
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const raw = useMemo(() => (audioUrl || "").trim(), [audioUrl]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPlayUrl(null);
      setUrlError(null);

      if (!raw) {
        setUrlError("Audio unavailable");
        return;
      }

      // Never sign temp paths
      if (isTempPath(raw)) {
        setUrlError("Audio unavailable");
        return;
      }

      // If it's already playable (signed or public), use it directly.
      if (raw.startsWith("http") && (isSignedSupabaseUrl(raw) || isPublicSupabaseUrl(raw))) {
        if (!cancelled) setPlayUrl(raw);
        return;
      }

      // Derive storage key
      const key = toStoragePath(raw, ATTACHMENTS_BUCKET);
      if (!key) {
        if (!cancelled) setUrlError("Audio unavailable");
        return;
      }

      // If we already know it is missing, do not request again
      if (missingKeys.has(key)) {
        if (!cancelled) setUrlError("Audio unavailable");
        return;
      }

      const now = Date.now();
      const cached = signedCache.get(key);
      if (cached && cached.expiresAt > now + 10_000) {
        if (!cancelled) setPlayUrl(cached.url);
        return;
      }

      try {
        // One attempt only: if not_found, stop forever.
        const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(key, 3600);

        if (error) {
          if (isObjectNotFound(error)) {
            missingKeys.add(key);
            saveMissingKeysToSession();
            // Don’t warn-spam for not_found
            if (!cancelled) setUrlError("Audio unavailable");
            return;
          }

          logger.warn("[VoicePlayer] createSignedUrl failed", { key, error });
          if (!cancelled) setUrlError("Failed to load audio");
          return;
        }

        const url = data?.signedUrl ?? null;
        if (!url) {
          if (!cancelled) setUrlError("Failed to load audio");
          return;
        }

        signedCache.set(key, { url, expiresAt: now + 3600 * 1000 });
        if (!cancelled) setPlayUrl(url);
      } catch (err: any) {
        if (isObjectNotFound(err)) {
          missingKeys.add(key);
          saveMissingKeysToSession();
          if (!cancelled) setUrlError("Audio unavailable");
          return;
        }

        logger.error("[VoicePlayer] unexpected error", err);
        if (!cancelled) setUrlError("Failed to load audio");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [raw]);

  const { isPlaying, currentTime, duration: audioDuration, togglePlayPause } = useAudioPlayer(playUrl || "");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = audioDuration > 0 ? currentTime / audioDuration : 0;
  const displayDuration = audioDuration > 0 ? audioDuration : duration;

  if (urlError) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-muted/50 min-w-[250px]", className)}>
        <span className="text-xs text-muted-foreground">{urlError}</span>
      </div>
    );
  }

  if (!playUrl) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-muted/50 min-w-[250px]", className)}>
        <span className="text-xs text-muted-foreground">Loading audio...</span>
      </div>
    );
  }

return (
  <div
    className={cn(
      "flex items-center gap-3 rounded-2xl bg-green-100 px-4 py-3 shadow-sm min-w-[260px] max-w-md",
      className
    )}
  >
    <button
      onClick={togglePlayPause}
      className="flex-shrink-0 w-11 h-11 rounded-full bg-white text-green-700 flex items-center justify-center shadow hover:scale-105 transition-transform"
      disabled={!playUrl}
      type="button"
    >
      {isPlaying ? (
        <Pause className="w-5 h-5" />
      ) : (
        <Play className="w-5 h-5 ml-0.5" />
      )}
    </button>

    <div className="flex-1 flex flex-col gap-1">
      <AudioWaveform
        duration={displayDuration}
        progress={progress}
        isPlaying={isPlaying}
        className="w-full"
      />

      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Voice message</span>
        <span>{formatTime(isPlaying ? currentTime : displayDuration)}</span>
      </div>
    </div>
  </div>
);
};
export default VoiceMessagePlayer;