import { useState, useRef, useEffect, useCallback } from "react";
import { Surah, Reciter } from "@/data/quranData";
import { logger } from "@/lib/logger";

function canPlayMp3() {
  const a = document.createElement("audio");
  return !!a.canPlayType && a.canPlayType("audio/mpeg") !== "";
}

/**
 * Disabled: debug probe removed to avoid 206 / streaming errors in devtools.
 * This is not required for audio playback.
 */
async function headContentType(_url: string) {
  void _url; // keep signature, avoid unused warning
  return "";
}

export const useQuranPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [currentReciter, setCurrentReciter] = useState<Reciter | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setProgress(audio.currentTime || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.src = "";
      audio.load();

      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);

      audioRef.current = null;
    };
  }, []);

  const loadSurah = useCallback(
    async (surah: Surah, reciter: Reciter) => {
      const audio = audioRef.current;
      if (!audio) {
        logger.error("Audio element not initialized");
        setError("Audio player not ready. Please refresh the page.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setCurrentSurah(surah);
      setCurrentReciter(reciter);
      setProgress(0);

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      }

      try {
        const surahNumber = surah.number.toString().padStart(3, "0");

        const baseUrl =
          `https://enevjiodbmngnkwkwuud.supabase.co/functions/v1/quran-audio-proxy` +
          `?surah=${surahNumber}&reciter=${encodeURIComponent(reciter.subdirectory)}`;

        let url = baseUrl;

        logger.info("[Quran] loading audio", {
          surahNumber,
          reciter: reciter.name,
          url,
        });

        // Reset audio
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
        audio.preload = "metadata";

        // Keep call for compatibility (no-op now)
        const ct = await headContentType(url);
        if (ct) logger.info("[Quran] audio content-type", { url, contentType: ct });

        audio.src = url;

        await new Promise<void>((resolve, reject) => {
          let timeoutId: number | undefined;

          const onCanPlay = () => {
            cleanup();
            resolve();
          };

          const onErr = () => {
            const mediaErr = audio.error;
            const code = mediaErr?.code;
            const message = mediaErr?.message;

            logger.error("[Quran] Audio loading error", { url, code, message });

            cleanup();

            // Retry with explicit mp3 hint (proxy can ignore if not supported)
            if (code === 4 && canPlayMp3()) {
              const mp3Url = `${baseUrl}&format=mp3`;
              logger.info("[Quran] retry with mp3", { mp3Url });

              audio.src = "";
              audio.load();
              audio.src = mp3Url;
              audio.load();

              waitForCanPlay(mp3Url).then(resolve).catch(reject);
              return;
            }

            let msg = "Failed to load audio";
            if (code === 2) msg = "Network error. Please check your internet connection.";
            if (code === 4) msg = "Audio format not supported on this device.";
            reject(new Error(msg));
          };

          const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("error", onErr);
          };

          const waitForCanPlay = (currentUrl: string) =>
            new Promise<void>((res2, rej2) => {
              let t2: number | undefined;

              const ok = () => {
                cleanup2();
                res2();
              };

              const bad = () => {
                const me = audio.error;
                logger.error("[Quran] retry error", {
                  currentUrl,
                  code: me?.code,
                  message: me?.message,
                });
                cleanup2();
                rej2(new Error("Audio format not supported on this device."));
              };

              const cleanup2 = () => {
                if (t2) clearTimeout(t2);
                audio.removeEventListener("canplay", ok);
                audio.removeEventListener("error", bad);
              };

              audio.addEventListener("canplay", ok, { once: true });
              audio.addEventListener("error", bad, { once: true });

              t2 = window.setTimeout(() => {
                cleanup2();
                rej2(new Error("Audio loading timeout. Please try again."));
              }, 45000);
            });

          audio.addEventListener("canplay", onCanPlay, { once: true });
          audio.addEventListener("error", onErr, { once: true });

          audio.load();

          timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error("Audio loading timeout. Please try again."));
          }, 45000);
        });

        setIsLoading(false);
        logger.info("[Quran] Audio ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load audio";
        logger.error("Load surah error:", err);
        setError(msg);
        setIsLoading(false);
      }
    },
    [isPlaying]
  );

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !currentSurah) {
      logger.warn("Cannot play: audio not ready");
      setError("Please select a Surah to play");
      return;
    }

    setUserInteracted(true);

    try {
      await audio.play();
      setIsPlaying(true);
      logger.info("Playback started");
    } catch (err) {
      logger.error("Play error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to play audio";

      if (errorMsg.includes("NotAllowedError") || errorMsg.toLowerCase().includes("user")) {
        setError("Please tap the play button to start audio playback");
      } else {
        setError("Failed to play audio. Please check your connection and try again.");
      }

      setIsPlaying(false);
    }
  };

  const pause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    logger.info("Playback paused");
  };

  const togglePlayPause = () => {
    if (isPlaying) pause();
    else void play();
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setProgress(time);
  };

  const changeVolume = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const clamped = Math.max(0, Math.min(1, newVolume));
    audio.volume = clamped;
    setVolume(clamped);
  };

  return {
    isPlaying,
    currentSurah,
    currentReciter,
    progress,
    duration,
    volume,
    isLoading,
    error,
    userInteracted,
    loadSurah,
    togglePlayPause,
    seek,
    changeVolume,
  };
};