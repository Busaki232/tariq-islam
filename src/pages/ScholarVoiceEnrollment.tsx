import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type ScholarRecord = {
  id: string;
  user_id: string;
  display_name: string;
};

type VoiceProfile = {
  id: string;
  status: string;
  enrollment_language_code: string;
  voice_sample_storage_path: string | null;
  consent_recording_storage_path: string | null;
  consent_granted_at: string | null;
  consent_revoked_at: string | null;
  error_message: string | null;
};

type RecordingKind = "sample" | "consent";

const CONSENT_TEXT_VERSION = "v1";

const consentStatement =
  "I consent to Tariq Islam securely using my recorded voice to create translated audio for my approved scholar lectures. I understand that I may revoke this consent.";

const ScholarVoiceEnrollment = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [scholar, setScholar] =
    useState<ScholarRecord | null>(null);
  const [voiceProfile, setVoiceProfile] =
    useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [checkingAccess, setCheckingAccess] =
    useState(false);
  const [accessResult, setAccessResult] = useState<{
    eligible: boolean;
    message: string;
  } | null>(null);

  const [languageCode, setLanguageCode] = useState("en");
  const [consentAccepted, setConsentAccepted] =
    useState(false);

  const [activeRecording, setActiveRecording] =
    useState<RecordingKind | null>(null);

  const [sampleBlob, setSampleBlob] =
    useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] =
    useState<string | null>(null);

  const [consentBlob, setConsentBlob] =
    useState<Blob | null>(null);
  const [consentUrl, setConsentUrl] =
    useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingKindRef =
    useRef<RecordingKind | null>(null);

  useEffect(() => {
    return () => {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      if (consentUrl) URL.revokeObjectURL(consentUrl);

      streamRef.current?.getTracks().forEach((track) =>
        track.stop()
      );
    };
  }, [sampleUrl, consentUrl]);

  useEffect(() => {
    const loadEnrollment = async () => {
      if (!user?.id || !scholarId) {
        setLoading(false);
        return;
      }

      try {
        const { data: scholarData, error: scholarError } =
          await supabase
            .from("scholar_profiles")
            .select("id,user_id,display_name")
            .eq("id", scholarId)
            .eq("user_id", user.id)
            .eq("verification_status", "approved")
            .eq("is_active", true)
            .maybeSingle();

        if (scholarError) throw scholarError;

        if (!scholarData) {
          setScholar(null);
          return;
        }

        setScholar(scholarData as ScholarRecord);

        const { data: profileData, error: profileError } =
          await supabase
            .from("scholar_voice_profiles")
            .select(
              "id,status,enrollment_language_code,voice_sample_storage_path,consent_recording_storage_path,consent_granted_at,consent_revoked_at,error_message"
            )
            .eq("scholar_id", scholarId)
            .maybeSingle();

        if (profileError) throw profileError;

        if (profileData) {
          const profile = profileData as VoiceProfile;
          setVoiceProfile(profile);
          setLanguageCode(
            profile.enrollment_language_code || "en"
          );
          setConsentAccepted(
            Boolean(
              profile.consent_granted_at &&
                !profile.consent_revoked_at
            )
          );
        }
      } catch (error) {
        console.error(
          "Unable to load voice enrollment:",
          error
        );

        toast({
          title: "Unable to load voice enrollment",
          description:
            error instanceof Error
              ? error.message
              : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadEnrollment();
  }, [scholarId, user?.id, toast]);

  const chooseMimeType = () => {
    const choices = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];

    return (
      choices.find((type) =>
        MediaRecorder.isTypeSupported(type)
      ) || ""
    );
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) =>
      track.stop()
    );
    streamRef.current = null;
  };

  const startRecording = async (kind: RecordingKind) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone unavailable",
        description:
          "This device cannot access microphone recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

      const mimeType = chooseMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingKindRef.current = kind;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedKind = recordingKindRef.current;
        const blob = new Blob(chunksRef.current, {
          type:
            recorder.mimeType ||
            mimeType ||
            "audio/webm",
        });
        const url = URL.createObjectURL(blob);

        if (recordedKind === "sample") {
          setSampleUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return url;
          });
          setSampleBlob(blob);
        } else if (recordedKind === "consent") {
          setConsentUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return url;
          });
          setConsentBlob(blob);
        }

        chunksRef.current = [];
        recordingKindRef.current = null;
        setActiveRecording(null);
        stopStream();
      };

      recorder.onerror = () => {
        setActiveRecording(null);
        stopStream();

        toast({
          title: "Recording failed",
          description:
            "The recording could not be completed.",
          variant: "destructive",
        });
      };

      recorder.start(250);
      setActiveRecording(kind);
    } catch (error) {
      console.error("Unable to record audio:", error);

      toast({
        title: "Microphone permission required",
        description:
          "Allow microphone access and try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;

    if (recorder?.state === "recording") {
      recorder.stop();
    }
  };

  const clearRecording = (kind: RecordingKind) => {
    if (kind === "sample") {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      setSampleUrl(null);
      setSampleBlob(null);
    } else {
      if (consentUrl) URL.revokeObjectURL(consentUrl);
      setConsentUrl(null);
      setConsentBlob(null);
    }
  };

  const extensionForBlob = (blob: Blob) => {
    const type = blob.type.toLowerCase();

    if (type.includes("mp4") || type.includes("m4a")) {
      return "m4a";
    }

    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";

    return "webm";
  };

  const uploadRecording = async (
    blob: Blob,
    kind: RecordingKind
  ) => {
    if (!user?.id || !scholarId) {
      throw new Error("Missing scholar account.");
    }

    const extension = extensionForBlob(blob);
    const path =
      `${user.id}/${scholarId}/${kind}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("scholar-voice-enrollment")
      .upload(path, blob, {
        contentType: blob.type || "audio/webm",
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    return path;
  };

  const saveEnrollment = async () => {
    if (!user?.id || !scholarId || !scholar) return;

    if (!sampleBlob) {
      toast({
        title: "Voice sample required",
        description:
          "Record your voice sample before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (!consentBlob) {
      toast({
        title: "Consent recording required",
        description:
          "Record the displayed consent statement.",
        variant: "destructive",
      });
      return;
    }

    if (!consentAccepted) {
      toast({
        title: "Consent confirmation required",
        description:
          "Confirm the consent checkbox before continuing.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const samplePath =
        await uploadRecording(sampleBlob, "sample");

      let consentPath: string;

      try {
        consentPath =
          await uploadRecording(consentBlob, "consent");
      } catch (error) {
        await supabase.storage
          .from("scholar-voice-enrollment")
          .remove([samplePath]);

        throw error;
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("scholar_voice_profiles")
        .upsert(
          {
            scholar_id: scholarId,
            user_id: user.id,
            enrollment_language_code: languageCode,
            voice_sample_storage_path: samplePath,
            consent_recording_storage_path: consentPath,
            consent_text_version: CONSENT_TEXT_VERSION,
            consent_granted_at: now,
            consent_revoked_at: null,
            status: "draft",
            error_message: null,
          },
          {
            onConflict: "scholar_id",
          }
        )
        .select(
          "id,status,enrollment_language_code,voice_sample_storage_path,consent_recording_storage_path,consent_granted_at,consent_revoked_at,error_message"
        )
        .single();

      if (error) {
        await supabase.storage
          .from("scholar-voice-enrollment")
          .remove([samplePath, consentPath]);

        throw error;
      }

      setVoiceProfile(data as VoiceProfile);

      toast({
        title: "Voice enrollment saved",
        description:
          "Your private recordings and consent were saved securely.",
      });
    } catch (error) {
      console.error(
        "Unable to save voice enrollment:",
        error
      );

      toast({
        title: "Enrollment failed",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const checkOpenAIAccess = async () => {
    if (!scholarId) {
      return;
    }

    setCheckingAccess(true);
    setAccessResult(null);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "check-openai-custom-voice-access",
          {
            body: {
              scholarId,
            },
          }
        );

      if (error) {
        throw error;
      }

      setAccessResult({
        eligible: data?.eligible === true,
        message:
          typeof data?.message === "string"
            ? data.message
            : data?.eligible === true
              ? "OpenAI Custom Voice access is available."
              : "OpenAI Custom Voice access is not currently available.",
      });
    } catch (error) {
      console.error(
        "Unable to check OpenAI Custom Voice access:",
        error
      );

      setAccessResult({
        eligible: false,
        message:
          "Unable to verify access. Check the Edge Function logs.",
      });
    } finally {
      setCheckingAccess(false);
    }
  };

  const revokeConsent = async () => {
    if (!voiceProfile || !user?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Revoke voice translation consent? Your private enrollment recordings will be removed and no new translated audio will be generated."
    );

    if (!confirmed) {
      return;
    }

    setRevoking(true);

    try {
      const storagePaths = [
        voiceProfile.voice_sample_storage_path,
        voiceProfile.consent_recording_storage_path,
      ].filter((value): value is string => Boolean(value));

      const revokedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("scholar_voice_profiles")
        .update({
          status: "revoked",
          consent_revoked_at: revokedAt,
          voice_sample_storage_path: null,
          consent_recording_storage_path: null,
          provider: null,
          provider_voice_id: null,
          error_message: null,
        })
        .eq("id", voiceProfile.id)
        .eq("user_id", user.id)
        .select(
          "id,status,enrollment_language_code,voice_sample_storage_path,consent_recording_storage_path,consent_granted_at,consent_revoked_at,error_message"
        )
        .single();

      if (error) {
        throw error;
      }

      setVoiceProfile(data as VoiceProfile);
      setConsentAccepted(false);

      if (sampleUrl) {
        URL.revokeObjectURL(sampleUrl);
      }

      if (consentUrl) {
        URL.revokeObjectURL(consentUrl);
      }

      setSampleBlob(null);
      setSampleUrl(null);
      setConsentBlob(null);
      setConsentUrl(null);

      if (storagePaths.length > 0) {
        const { error: removalError } = await supabase.storage
          .from("scholar-voice-enrollment")
          .remove(storagePaths);

        if (removalError) {
          console.error(
            "Consent was revoked, but enrollment file cleanup failed:",
            removalError
          );

          toast({
            title: "Consent revoked",
            description:
              "Consent was revoked immediately. Some private file cleanup still requires attention.",
          });

          return;
        }
      }

      toast({
        title: "Consent revoked",
        description:
          "Your private enrollment recordings were removed. Voice translation is disabled.",
      });
    } catch (error) {
      console.error(
        "Unable to revoke voice consent:",
        error
      );

      toast({
        title: "Unable to revoke consent",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  const renderRecorder = (
    kind: RecordingKind,
    title: string,
    description: string,
    audioUrl: string | null
  ) => {
    const isRecording = activeRecording === kind;
    const anotherRecordingActive =
      activeRecording !== null && !isRecording;

    return (
      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {audioUrl ? (
          <div className="space-y-3">
            <audio
              src={audioUrl}
              controls
              className="w-full"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => clearRecording(kind)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Record Again
            </Button>
          </div>
        ) : isRecording ? (
          <Button
            type="button"
            variant="destructive"
            onClick={stopRecording}
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            Stop Recording
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={anotherRecordingActive}
            onClick={() => void startRecording(kind)}
          >
            <Mic className="mr-2 h-4 w-4" />
            Start Recording
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  if (!user || !scholar) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl">
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              An active approved scholar account is required.
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/scholars")}
            >
              Return to Scholars
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            navigate(`/scholars/${scholarId}/lectures/new`)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lecture Studio
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Voice Translation Setup
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Enrollment for {scholar.display_name}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                <div>
                  <p className="font-semibold">
                    Your recordings remain private
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    They are used only for your authorized
                    lecture translations. You can revoke your
                    consent later.
                  </p>
                </div>
              </div>
            </div>

            {voiceProfile && (
              <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-600" />

                <span>
                  Current enrollment status:{" "}
                  <strong>{voiceProfile.status}</strong>
                </span>
              </div>
            )}

            {voiceProfile?.consent_granted_at &&
              !voiceProfile.consent_revoked_at && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div>
                    <h3 className="font-semibold">
                      OpenAI Custom Voice
                    </h3>

                    <p className="text-sm text-muted-foreground">
                      Check whether this API project has access.
                      No recording will be uploaded during this
                      check.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkingAccess}
                    onClick={() =>
                      void checkOpenAIAccess()
                    }
                  >
                    {checkingAccess && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}

                    Check OpenAI Access
                  </Button>

                  {accessResult && (
                    <div
                      className={
                        accessResult.eligible
                          ? "rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700"
                          : "rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700"
                      }
                    >
                      {accessResult.message}
                    </div>
                  )}
                </div>
              )}

            <div className="space-y-2">
              <Label>Voice sample language</Label>

              <Select
                value={languageCode}
                onValueChange={setLanguageCode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="ha">Hausa</SelectItem>
                  <SelectItem value="yo">Yorùbá</SelectItem>
                  <SelectItem value="ur">Urdu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {renderRecorder(
              "sample",
              "1. Record your voice sample",
              "Speak naturally and clearly for 30 to 60 seconds in a quiet room.",
              sampleUrl
            )}

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="mb-2 text-sm font-semibold">
                Read this exact statement aloud:
              </p>

              <p className="text-sm leading-relaxed">
                “{consentStatement}”
              </p>
            </div>

            {renderRecorder(
              "consent",
              "2. Record your spoken consent",
              "Read the complete consent statement shown above.",
              consentUrl
            )}

            <div className="flex items-start gap-3 rounded-xl border p-4">
              <Checkbox
                id="voice-consent"
                checked={consentAccepted}
                onCheckedChange={(checked) =>
                  setConsentAccepted(checked === true)
                }
              />

              <Label
                htmlFor="voice-consent"
                className="cursor-pointer text-sm leading-relaxed"
              >
                I give explicit permission for Tariq Islam to
                use my private voice sample to create translated
                audio for my approved lectures. I understand
                that I may revoke this permission.
              </Label>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={
                saving ||
                activeRecording !== null ||
                !sampleBlob ||
                !consentBlob ||
                !consentAccepted
              }
              onClick={() => void saveEnrollment()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}

              Save Voice Enrollment
            </Button>

            {voiceProfile?.consent_granted_at &&
              !voiceProfile.consent_revoked_at && (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={revoking || saving}
                  onClick={() => void revokeConsent()}
                >
                  {revoking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}

                  Revoke Consent and Delete Recordings
                </Button>
              )}

            <p className="text-center text-xs text-muted-foreground">
              Saving enrollment does not generate or publish
              translated audio yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ScholarVoiceEnrollment;
