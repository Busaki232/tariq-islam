import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectionStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "connected"
  | "stopping"
  | "error";

type RealtimeEvent = {
  type?: string;
  delta?: string;
  error?: {
    message?: string;
  };
};

const TARGET_LANGUAGES = [
  { code: "en", label: "English", realtime: true },
  { code: "ar", label: "Arabic", realtime: true },
  { code: "fr", label: "French", realtime: true },
  { code: "es", label: "Spanish", realtime: true },
  { code: "de", label: "German", realtime: true },
  { code: "pt", label: "Portuguese", realtime: true },
  { code: "tr", label: "Turkish", realtime: true },
  { code: "ur", label: "Urdu", realtime: true },
  { code: "sw", label: "Swahili", realtime: true },
  {
    code: "yo",
    label: "Yorùbá — fallback translation",
    realtime: false,
  },
  {
    code: "ha",
    label: "Hausa — fallback translation",
    realtime: false,
  },
] as const;

const getClientSecret = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    value?: unknown;
    client_secret?: unknown;
  };

  if (typeof response.value === "string") {
    return response.value;
  }

  if (typeof response.client_secret === "string") {
    return response.client_secret;
  }

  if (
    response.client_secret &&
    typeof response.client_secret === "object" &&
    "value" in response.client_secret
  ) {
    const value = (response.client_secret as { value?: unknown }).value;

    if (typeof value === "string") {
      return value;
    }
  }

  return null;
};

export default function RealtimeTranslation() {
  const navigate = useNavigate();

  const [targetLanguage, setTargetLanguage] = useState("en");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sourceTranscript, setSourceTranscript] = useState("");
  const [translatedTranscript, setTranslatedTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const translatedAudioRef = useRef<HTMLAudioElement | null>(null);

  const isActive =
    status === "connecting" ||
    status === "connected" ||
    status === "requesting-permission";

  const stopTranslation = () => {
    setStatus((current) => (current === "idle" ? "idle" : "stopping"));

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });

      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (sourceStreamRef.current) {
      sourceStreamRef.current.getTracks().forEach((track) => track.stop());
      sourceStreamRef.current = null;
    }

    if (translatedAudioRef.current) {
      translatedAudioRef.current.pause();
      translatedAudioRef.current.srcObject = null;
    }

    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      if (sourceStreamRef.current) {
        sourceStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (translatedAudioRef.current) {
        translatedAudioRef.current.pause();
        translatedAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const handleRealtimeEvent = (message: MessageEvent<string>) => {
    try {
      const event = JSON.parse(message.data) as RealtimeEvent;

      console.log("[RealtimeTranslation] event:", event);

      if (
        event.type === "session.input_transcript.delta" &&
        typeof event.delta === "string"
      ) {
        setSourceTranscript((current) => current + event.delta);
      }

      if (
        event.type === "session.output_transcript.delta" &&
        typeof event.delta === "string"
      ) {
        setTranslatedTranscript((current) => current + event.delta);
      }

      if (event.type === "error") {
        const message =
          event.error?.message || "The translation session reported an error.";

        console.error("[RealtimeTranslation] OpenAI error:", event);
        setErrorMessage(message);
        toast.error(message);
      }
    } catch (error) {
      console.warn(
        "[RealtimeTranslation] Could not parse event:",
        error,
        message.data,
      );
    }
  };

  const startTranslation = async () => {
    if (isActive) return;

    const selectedLanguage = TARGET_LANGUAGES.find(
      (language) => language.code === targetLanguage,
    );

    if (selectedLanguage && !selectedLanguage.realtime) {
      toast.info(
        `${selectedLanguage.label.replace(" — fallback translation", "")} translation requires the Tariq Islam fallback translator, which we will connect next.`,
      );
      return;
    }

    setErrorMessage("");
    setSourceTranscript("");
    setTranslatedTranscript("");

    try {
      setStatus("requesting-permission");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is not supported on this device.",
        );
      }

      const sourceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      sourceStreamRef.current = sourceStream;
      setStatus("connecting");

      const { data, error } = await supabase.functions.invoke(
        "realtime-session",
        {
          body: {
            targetLanguage,
          },
        },
      );

      if (error) {
        let detailedMessage = error.message;

        try {
          const context = error.context as Response | undefined;

          if (context) {
            const responseBody = await context.clone().text();

            if (responseBody) {
              try {
                const parsed = JSON.parse(responseBody);

                detailedMessage =
                  parsed?.error?.message ||
                  parsed?.message ||
                  responseBody;
              } catch {
                detailedMessage = responseBody;
              }
            }
          }
        } catch (contextError) {
          console.warn(
            "[RealtimeTranslation] Could not read Edge Function error:",
            contextError,
          );
        }

        throw new Error(
          detailedMessage ||
            "Unable to create the translation session.",
        );
      }

      const clientSecret = getClientSecret(data);

      if (!clientSecret) {
        console.error(
          "[RealtimeTranslation] Missing client secret response:",
          data,
        );

        throw new Error(
          "Supabase did not return a temporary Realtime client secret.",
        );
      }

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const dataChannel =
        peerConnection.createDataChannel("oai-events");

      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = handleRealtimeEvent;

      dataChannel.onopen = () => {
        console.log("[RealtimeTranslation] Event channel connected.");
      };

      dataChannel.onerror = (event) => {
        console.error(
          "[RealtimeTranslation] Data channel error:",
          event,
        );
      };

      sourceStream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, sourceStream);
      });

      peerConnection.ontrack = async ({ streams }) => {
        const translatedStream = streams[0];

        if (!translatedStream || !translatedAudioRef.current) {
          return;
        }

        translatedAudioRef.current.srcObject = translatedStream;

        try {
          await translatedAudioRef.current.play();
        } catch (playError) {
          console.warn(
            "[RealtimeTranslation] Audio autoplay was blocked:",
            playError,
          );
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const connectionState = peerConnection.connectionState;

        console.log(
          "[RealtimeTranslation] Connection state:",
          connectionState,
        );

        if (connectionState === "connected") {
          setStatus("connected");
          toast.success("Live translation started.");
        }

        if (
          connectionState === "failed" ||
          connectionState === "disconnected"
        ) {
          setErrorMessage(
            "The live translation connection was interrupted.",
          );
          setStatus("error");
        }

        if (connectionState === "closed") {
          setStatus("idle");
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (!offer.sdp) {
        throw new Error("Unable to create the WebRTC connection offer.");
      }

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/translations/calls",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );

      if (!sdpResponse.ok) {
        const responseText = await sdpResponse.text();

        throw new Error(
          responseText ||
            `OpenAI connection failed with status ${sdpResponse.status}.`,
        );
      }

      const answerSdp = await sdpResponse.text();

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      console.error(
        "[RealtimeTranslation] Start failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to start live translation.";

      setErrorMessage(message);
      setStatus("error");
      toast.error(message);

      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (sourceStreamRef.current) {
        sourceStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        sourceStreamRef.current = null;
      }
    }
  };

  const statusLabel = {
    idle: "Ready",
    "requesting-permission": "Requesting microphone permission",
    connecting: "Connecting",
    connected: "Listening and translating",
    stopping: "Stopping",
    error: "Connection error",
  }[status];

  return (
    <main className="min-h-screen bg-background px-4 pb-28 pt-4">
      <audio
        ref={translatedAudioRef}
        autoPlay
        playsInline
        className="hidden"
      />

      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold">
              Live Translation
            </h1>
            <p className="text-sm text-muted-foreground">
              Translate spoken audio in real time
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Translation language
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="target-language"
                className="text-sm font-medium"
              >
                Translate into
              </label>

              <select
                id="target-language"
                value={targetLanguage}
                disabled={isActive}
                onChange={(event) =>
                  setTargetLanguage(event.target.value)
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TARGET_LANGUAGES.map((language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    status === "connected"
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status === "connected" ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <p className="font-medium">{statusLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {status === "connected"
                      ? "Speak clearly into your microphone."
                      : "Press Start Translation when ready."}
                  </p>
                </div>
              </div>
            </div>

            {!isActive && status !== "connected" ? (
              <Button
                type="button"
                className="h-12 w-full"
                onClick={startTranslation}
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Translation
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="h-12 w-full"
                onClick={stopTranslation}
              >
                {status === "stopping" ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <MicOff className="mr-2 h-5 w-5" />
                )}
                Stop Translation
              </Button>
            )}

            {(status === "requesting-permission" ||
              status === "connecting") && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {statusLabel}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Original speech
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="min-h-24 whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">
              {sourceTranscript ||
                "The original-language transcript will appear here."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Translation
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="min-h-24 whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">
              {translatedTranscript ||
                "The translated transcript will appear here."}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
