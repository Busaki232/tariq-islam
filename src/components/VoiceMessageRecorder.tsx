import { useState, useEffect, useRef } from "react";
import { Mic, X, Send } from "lucide-react";
import { HeroButton } from "./ui/hero-button";
import { AudioRecorder } from "@/utils/audioRecorder";
import { cn } from "@/lib/utils";

interface VoiceMessageRecorderProps {
  onSend: (audioBlob: Blob, duration: number, mimeType: string) => Promise<void>;
  onCancel: () => void;
}

export const VoiceMessageRecorder = ({
  onSend,
  onCancel,
}: VoiceMessageRecorderProps) => {
  const [recorder] = useState(() => new AudioRecorder());
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    void startRecording();

    return () => {
      if (recorder.isRecording()) {
        recorder.cancelRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const interval = window.setInterval(() => {
      const nextDuration = recorder.getDuration();
      setDuration(nextDuration);

      if (nextDuration >= 300 && recorder.isRecording() && !sendingRef.current) {
        void handleSend();
      }
    }, 100);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startRecording = async () => {
    try {
      await recorder.startRecording();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      onCancel();
    }
  };

  const handleSend = async () => {
    if (sendingRef.current || isSending) return;

    if (!recorder.isRecording()) {
      setError("No recording in progress. Please try again.");
      return;
    }

    sendingRef.current = true;
    setIsSending(true);

    try {
      const finalDuration = recorder.getDuration();
      const { blob: audioBlob, mimeType } = await recorder.stopRecording();

      setIsRecording(false);

      if (audioBlob.size < 1000) {
        setError("Recording failed - audio too short or empty. Please try again.");
        console.error("[VoiceRecorder] Invalid blob size:", audioBlob.size);
        sendingRef.current = false;
        setIsSending(false);
        return;
      }

      console.log("[VoiceRecorder] Sending voice message:", {
        size: audioBlob.size,
        duration: finalDuration,
        mimeType,
      });

      await onSend(audioBlob, finalDuration, mimeType);
    } catch (err) {
      console.error("[VoiceRecorder] Error:", err);
      setError("Failed to send voice message");
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    if (recorder.isRecording()) {
      recorder.cancelRecording();
    }

    setIsRecording(false);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const wholeSeconds = Math.floor(seconds);
    const mins = Math.floor(wholeSeconds / 60);
    const secs = wholeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 p-8">
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="text-4xl font-mono font-bold text-primary">
          {formatTime(duration)}
        </div>

        <div className="relative">
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-primary/20 animate-ping",
              !isRecording && "hidden"
            )}
          />

          <div className="relative w-24 h-24 rounded-full bg-primary flex items-center justify-center">
            <Mic className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <div className="flex gap-4">
          <HeroButton
            onClick={handleCancel}
            variant="outline"
            size="lg"
            className="gap-2"
            disabled={isSending}
          >
            <X className="w-5 h-5" />
            Cancel
          </HeroButton>

          <HeroButton
            onClick={() => void handleSend()}
            size="lg"
            className="gap-2"
            disabled={duration < 0.5 || isSending}
          >
            <Send className="w-5 h-5" />
            {isSending ? "Sending..." : "Send"}
          </HeroButton>
        </div>

        <p className="text-sm text-muted-foreground">Maximum duration: 5:00</p>
      </div>
    </div>
  );
};