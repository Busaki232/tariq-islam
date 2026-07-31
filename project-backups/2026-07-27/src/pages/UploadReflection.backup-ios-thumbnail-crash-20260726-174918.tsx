import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Upload,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LANGUAGES } from "@/config/languages";

const CATEGORY_VALUES = [
  "Daily Reminder",
  "Quran",
  "Hadith",
  "Prayer",
  "Family",
  "Ramadan",
  "Dawah",
] as const;

export default function UploadReflection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get("edit");
  const [workingReflectionId, setWorkingReflectionId] =
    useState<string | null>(editingId);
  const isEditing = Boolean(workingReflectionId);
  const { t } = useTranslation();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Daily Reminder");
  const [language, setLanguage] = useState("English");
  const [referenceType, setReferenceType] = useState<
    "" | "quran" | "hadith"
  >("");
  const [quranSurahNumber, setQuranSurahNumber] = useState("");
  const [quranAyahStart, setQuranAyahStart] = useState("");
  const [quranAyahEnd, setQuranAyahEnd] = useState("");
  const [hadithCollection, setHadithCollection] = useState("");
  const [hadithNumber, setHadithNumber] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [captionsText, setCaptionsText] = useState("");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionsLanguage, setCaptionsLanguage] = useState("English");
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [translationProgress, setTranslationProgress] =
    useState("");
  const [translationLanguage, setTranslationLanguage] = useState("en");
  const [generatingTranslation, setGeneratingTranslation] =
    useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [translatedLanguageName, setTranslatedLanguageName] =
    useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [thumbnailTime, setThumbnailTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState<number | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(
    null
  );
  const [loadingReflection, setLoadingReflection] = useState(isEditing);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const galleryInputId = "reflection-gallery-input";
  const cameraInputId = "reflection-camera-input";


  useEffect(() => {
    if (!editingId || !user?.id) {
      setLoadingReflection(false);
      return;
    }

    let active = true;

    const loadReflection = async () => {
      setLoadingReflection(true);

      try {
        const { data, error } = await supabase
          .from("reflection_videos")
.select(
  "id,title,caption,category,language,video_url,status,user_id,thumbnail_url,trim_start_seconds,trim_end_seconds,reference_type,quran_surah_number,quran_ayah_start,quran_ayah_end,hadith_collection,hadith_number,reference_note,captions_text,captions_enabled,captions_language,scheduled_at,published_at"
)
          .eq("id", editingId)
          .eq("user_id", user.id)
          .in("status", ["draft", "pending", "rejected", "scheduled"])

.single();

if (error) throw error;

if (!active) return;
        if (!active) return;

        setTitle(data.title);
        setCaption(data.caption ?? "");
        setCategory(data.category);
        setLanguage(data.language);
        setReferenceType(
          data.reference_type === "quran" ||
            data.reference_type === "hadith"
            ? data.reference_type
            : ""
        );

        setQuranSurahNumber(
          data.quran_surah_number?.toString() ?? ""
        );
        setQuranAyahStart(
          data.quran_ayah_start?.toString() ?? ""
        );
        setQuranAyahEnd(
          data.quran_ayah_end?.toString() ?? ""
        );
        setHadithCollection(data.hadith_collection ?? "");
        setHadithNumber(data.hadith_number ?? "");
        setReferenceNote(data.reference_note ?? "");
        setCaptionsText(data.captions_text ?? "");
        setCaptionsEnabled(Boolean(data.captions_enabled));
        if (data.scheduled_at) {
          const scheduledDate = new Date(data.scheduled_at);

          const localDateTime = new Date(
            scheduledDate.getTime() -
              scheduledDate.getTimezoneOffset() * 60 * 1000
          )
            .toISOString()
            .slice(0, 16);

          setScheduledAt(localDateTime);
          setScheduleEnabled(data.status === "scheduled");
        } else {
          setScheduledAt("");
          setScheduleEnabled(false);
        }
        setExistingVideoUrl(data.video_url);
        setPreviewUrl(data.video_url);
        setTrimStartSeconds(Number(data.trim_start_seconds ?? 0));
        setTrimEndSeconds(
          data.trim_end_seconds === null
            ? null
            : Number(data.trim_end_seconds)
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load this reflection.";

        toast({
          title: "Could not load reflection",
          description: message,
          variant: "destructive",
        });

        navigate("/creator-studio");
      } finally {
        if (active) {
          setLoadingReflection(false);
        }
      }
    };

    void loadReflection();

    return () => {
      active = false;
    };
  }, [editingId, navigate, toast, user?.id]);

  const handleVideoChange = (

    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({
        title: t("reflections.invalidFile"),
        description: t("reflections.selectVideoFile"),
        variant: "destructive",
      });
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setVideoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setThumbnailTime(0);
    setVideoDuration(0);
    setTrimStartSeconds(0);
    setTrimEndSeconds(null);
  };

const createThumbnailBlob = async (): Promise<Blob | null> => {
  const video = previewVideoRef.current;

  if (!video || !previewUrl) return null;

  const canvas = document.createElement("canvas");

  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  const context = canvas.getContext("2d");

  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      0.85
    );
});
};

const handleGenerateCaptions = async () => {
  if (generatingCaptions || uploading) {
    return;
  }

  setGeneratingCaptions(true);

  try {
    let reflectionId = workingReflectionId;

    if (!reflectionId) {
      reflectionId = await handleSubmit("draft", {
        stayOnPage: true,
        silent: true,
      });

      if (!reflectionId) {
        throw new Error(
          "The reflection could not be saved before generating captions."
        );
      }

      toast({
        title: "Draft saved automatically",
        description:
          "Caption generation is continuing on this page.",
      });
    }

    const { data, error } = await supabase.functions.invoke(
      "generate-reflection-captions",
      {
        body: {
          reflectionId,
        },
      }
    );

   if (error) {
     if (error instanceof FunctionsHttpError) {
       let errorMessage = error.message;

       try {
         const errorBody = await error.context.json();

         console.error("Translation function error:", errorBody);

         if (typeof errorBody?.error === "string") {
           errorMessage = errorBody.error;
         }
       } catch {
         console.error(
           "Unable to read translation function response:",
           error
         );
       }

       throw new Error(errorMessage);
     }

     console.error("Translation invocation error:", error);
     throw error;
   }

    const generatedText =
      typeof data?.captionsText === "string"
        ? data.captionsText
        : "";

    if (!generatedText) {
      throw new Error("No caption text was returned.");
    }

    setCaptionsText(generatedText);
    setCaptionsEnabled(true);
    setCaptionsLanguage(
      typeof data?.captionsLanguage === "string"
        ? data.captionsLanguage
        : language
    );

    toast({
      title: "Captions generated",
      description:
        "Review and edit the generated captions before submitting.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not generate captions.";

    toast({
      title: "Caption generation failed",
      description: message,
      variant: "destructive",
    });
  } finally {
    setGeneratingCaptions(false);
  }
};

const handleGenerateTranslation = async () => {
  if (!workingReflectionId) {
    toast({
      title: "Save the reflection first",
      description:
        "Save this reflection as a draft before generating a translation.",
      variant: "destructive",
    });
    return;
  }

  if (!captionsText.trim()) {
    toast({
      title: "Captions required",
      description:
        "Generate timed captions before generating a translation.",
      variant: "destructive",
    });
    return;
  }

 setGeneratingTranslation(true);

 try {
   console.log("TRANSLATION REQUEST", {
     reflectionId: workingReflectionId,
     targetLanguageCode: translationLanguage,
   });

   const { data, error } = await supabase.functions.invoke(
     "translate-reflection-captions",
     {
       body: {
         reflectionId: workingReflectionId,
         targetLanguageCode: translationLanguage,
       },
     }
   );



   if (error) {
     if (error instanceof FunctionsHttpError) {
       let errorMessage = error.message;

       try {
         const errorBody = await error.context.json();

         console.error("Caption function error:", errorBody);

         if (typeof errorBody?.error === "string") {
           errorMessage = errorBody.error;
         }
       } catch {
         console.error(
           "Unable to read caption function response:",
           error
         );
       }

       throw new Error(errorMessage);
     }

     console.error("Caption invocation error:", error);
     throw error;
   }

    const translation = data?.translation;

    const nextTranslatedText =
      typeof translation?.translated_text === "string"
        ? translation.translated_text
        : "";

    const nextLanguageName =
      typeof translation?.language_name === "string"
        ? translation.language_name
        : "";

    if (!nextTranslatedText) {
     throw new Error("No translated text was returned.");
    }

    setTranslatedText(nextTranslatedText);
    setTranslatedLanguageName(nextLanguageName);

    toast({
      title: "Translation generated",
      description: `${nextLanguageName || "The translation"} is ready for review.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not generate the translation.";

    toast({
      title: "Translation failed",
      description: message,
      variant: "destructive",
    });
  } finally {
    setGeneratingTranslation(false);
  }
};
const handleGenerateAllTranslations = async () => {
  if (!workingReflectionId) {
    toast({
      title: "Save the reflection first",
      description:
        "Save this reflection as a draft before generating translations.",
      variant: "destructive",
    });
    return;
  }

  if (!captionsText.trim()) {
    toast({
      title: "Captions required",
      description:
        "Generate timed captions before generating translations.",
      variant: "destructive",
    });
    return;
  }

  const languages = [
    { code: "ar", name: "Arabic" },
    { code: "fr", name: "French" },
    { code: "ha", name: "Hausa" },
    { code: "yo", name: "Yoruba" },
  ];

  setGeneratingTranslation(true);

  try {
    for (let index = 0; index < languages.length; index += 1) {
      const language = languages[index];

      setTranslationProgress(
        `Generating ${language.name} translation (${index + 1} of ${
          languages.length
        })`
      );

      const { data, error } = await supabase.functions.invoke(
        "translate-reflection-captions",
        {
          body: {
            reflectionId: workingReflectionId,
            targetLanguageCode: language.code,
          },
        }
      );

      if (error) {
        if (error instanceof FunctionsHttpError) {
          let errorMessage = error.message;

          try {
            const errorBody = await error.context.json();

            if (typeof errorBody?.error === "string") {
              errorMessage = errorBody.error;
            }
          } catch {
            console.error(
              `Unable to read ${language.name} translation error:`,
              error
            );
          }

          throw new Error(
            `${language.name} translation failed: ${errorMessage}`
          );
        }

        throw error;
      }

      const translation = data?.translation;

      if (
        typeof translation?.translated_text !== "string" ||
        !translation.translated_text.trim()
      ) {
        throw new Error(
          `${language.name} translation returned no text.`
        );
      }

      setTranslatedText(translation.translated_text);
      setTranslatedLanguageName(
        translation.language_name || language.name
      );
    }

    toast({
      title: "Translations generated",
      description:
        "Arabic, French, Hausa, and Yoruba translations were generated and saved.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not generate all translations.";

    toast({
      title: "Translation failed",
      description: message,
      variant: "destructive",
    });
  } finally {
    setGeneratingTranslation(false);
    setTranslationProgress("");
  }
};

const handleSubmit = async (
  submissionStatus: "draft" | "pending" | "scheduled" = "pending",
  options?: {
    stayOnPage?: boolean;
    silent?: boolean;
  }
): Promise<string | null> => {
  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!videoFile && !existingVideoUrl) {
    toast({
      title: t("reflections.videoRequired"),
      description: t("reflections.chooseVideoFirst"),
      variant: "destructive",
    });
    return null;
  }

  if (!title.trim()) {
    toast({
      title: t("reflections.titleRequired"),
      description: t("reflections.addReflectionTitle"),
      variant: "destructive",
    });
    return null;
  }

if (submissionStatus === "scheduled") {
  if (!scheduleEnabled || !scheduledAt) {
    toast({
      title: "Schedule date required",
      description:
        "Choose a future date and time before scheduling this reflection.",
      variant: "destructive",
    });
    return null;
  }

  const scheduledDate = new Date(scheduledAt);

  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    toast({
      title: "Invalid schedule time",
      description:
        "Choose a date and time later than the current time.",
      variant: "destructive",
    });
    return null;
  }
}

if (
  referenceType === "quran" &&
  quranAyahStart &&
  quranAyahEnd &&
  Number(quranAyahEnd) < Number(quranAyahStart)
) {
  toast({
    title: "Invalid ayah range",
    description:
      "The ending ayah cannot be lower than the starting ayah.",
    variant: "destructive",
  });
  return null;
}


  setUploadProgress(0);
  setUploading(true);

  const progressTimer = window.setInterval(() => {
    setUploadProgress((previous) => {
      if (previous >= 90) return previous;
      return previous + 10;
    });
  }, 400);

  try {
    let videoUrl = existingVideoUrl;
    let thumbnailUrl: string | null = null;


    // Upload a new video only when the creator selected a replacement.
    const thumbnailBlob = await createThumbnailBlob();

    if (thumbnailBlob) {
      const thumbnailPath =
        `${user.id}/${crypto.randomUUID()}.jpg`;

      const { error: thumbnailUploadError } =
        await supabase.storage
          .from("reflection-videos")
          .upload(thumbnailPath, thumbnailBlob, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/jpeg",
          });

      if (thumbnailUploadError) {
        throw thumbnailUploadError;
      }

      const { data: thumbnailPublicUrlData } =
        supabase.storage
          .from("reflection-videos")
          .getPublicUrl(thumbnailPath);

      thumbnailUrl = thumbnailPublicUrlData.publicUrl;
    }
    if (videoFile) {
      const fileExtension =
        videoFile.name.split(".").pop() || "mp4";

      const filePath =
        `${user.id}/${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("reflection-videos")
        .upload(filePath, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("reflection-videos")
        .getPublicUrl(filePath);

      videoUrl = publicUrlData.publicUrl;
    }

    if (!videoUrl) {
      throw new Error("The reflection does not have a video.");
    }

    const reflectionValues = {
      title: title.trim(),
      caption: caption.trim() || null,
      category,
      language,
      captions_text: captionsText.trim() || null,
      captions_enabled: captionsEnabled && Boolean(captionsText.trim()),
      captions_language:
        captionsText.trim()
          ? captionsLanguage.trim() || language
          : null,
      reference_type: referenceType || null,

      quran_surah_number:
        referenceType === "quran" && quranSurahNumber
          ? Number(quranSurahNumber)
          : null,

      quran_ayah_start:
        referenceType === "quran" && quranAyahStart
          ? Number(quranAyahStart)
          : null,

      quran_ayah_end:
        referenceType === "quran" && quranAyahEnd
          ? Number(quranAyahEnd)
          : null,

      hadith_collection:
        referenceType === "hadith"
          ? hadithCollection.trim() || null
          : null,

      hadith_number:
        referenceType === "hadith"
          ? hadithNumber.trim() || null
          : null,

      reference_note: referenceNote.trim() || null,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      trim_start_seconds: trimStartSeconds,
      trim_end_seconds:
        trimEndSeconds ?? (videoDuration > 0 ? videoDuration : null),
      status: submissionStatus,
      scheduled_at:
        submissionStatus === "scheduled"
          ? new Date(scheduledAt).toISOString()
          : null,
      published_at: null,

    };

    console.log("REFLECTION SUBMISSION:", {
          submissionStatus,
          scheduledAt,
          reflectionValues,
        });

    let savedReflectionId: string;

    if (workingReflectionId) {
const { data: updatedReflection, error: updateError } =
  await supabase
    .from("reflection_videos")
    .update(reflectionValues)
    .eq("id", workingReflectionId)
    .eq("user_id", user.id)
    .in("status", ["draft", "pending", "rejected", "scheduled"])
    .select("id,title,status,scheduled_at,published_at")
    .single();

if (updateError) throw updateError;

savedReflectionId = updatedReflection.id;
setWorkingReflectionId(updatedReflection.id);

console.log("SAVED REFLECTION:", updatedReflection);
    } else {
    const { data: insertedReflection, error: insertError } =
      await supabase
        .from("reflection_videos")
        .insert({
          user_id: user.id,
          ...reflectionValues,
        })
        .select("id,title,status,scheduled_at,published_at")
        .single();

    if (insertError) throw insertError;

    savedReflectionId = insertedReflection.id;
    setWorkingReflectionId(insertedReflection.id);

    console.log("SAVED REFLECTION:", insertedReflection);
    }

    setUploadProgress(100);

    if (options?.stayOnPage) {
      if (!options.silent) {
        toast({
          title: "Draft saved automatically",
          description:
            "You can continue generating captions and translations.",
        });
      }

      return savedReflectionId;
    }

    if (workingReflectionId) {
      toast({
        title:
          submissionStatus === "draft"
            ? "Draft updated"
            : "Reflection resubmitted",
        description:
          submissionStatus === "draft"
            ? "Your changes were saved in Creator Studio."
            : "Your reflection is waiting for review.",
      });

      navigate("/creator-studio");
      return null;
    }

    if (submissionStatus === "draft") {
      toast({
        title: "Draft saved",
        description:
          "Your reflection was saved in Creator Studio.",
      });

      navigate("/creator-studio");
      return null;
    }

    setUploaded(true);

    toast({
      title: t("reflections.reflectionUploaded"),
      description: t("reflections.pendingReviewShort"),
    });

    return savedReflectionId;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : t("reflections.couldNotUpload");

    toast({
      title: isEditing
        ? "Could not update reflection"
        : t("reflections.uploadFailed"),
      description: message,
      variant: "destructive",
    });

    return null;
  } finally {
    window.clearInterval(progressTimer);
    setUploading(false);
  }
};

  if (uploaded) {
    return (
      <main className="min-h-screen bg-background px-4 py-20">
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-islamic-green" />

            <h1 className="text-2xl font-bold">
              {t("reflections.reflectionUploaded")}
            </h1>

            <p className="mt-3 text-muted-foreground">
              {t("reflections.pendingReviewMessage")}
            </p>

            <Button className="mt-6" onClick={() => navigate("/")}>
              {t("reflections.returnHome")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-20">
      <Card className="mx-auto max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Video className="h-6 w-6 text-islamic-green" />
            {t("reflections.uploadReflection")}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

            <p className="font-medium">
              {videoFile
                ? videoFile.name
                : t("reflections.chooseOrRecordVideo")}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {t("reflections.supportedVideoFormats")}
            </p>

            {previewUrl && (
              <>
<video
  ref={previewVideoRef}
  src={previewUrl}
  crossOrigin="anonymous"
  controls
  playsInline
  preload="metadata"
  onLoadedMetadata={() => {
    const preview = previewVideoRef.current;

    if (
      !preview ||
      !Number.isFinite(preview.duration) ||
      preview.duration <= 0
    ) {
      return;
    }

    const duration = preview.duration;

    setVideoDuration(duration);

    setTrimEndSeconds((current) => {
      if (
        current === null ||
        current <= 0 ||
        current > duration
      ) {
        return duration;
      }

      return current;
    });

    preview.currentTime =
      (thumbnailTime / 100) * duration;
  }}
  onTimeUpdate={() => {
    const preview = previewVideoRef.current;

    if (!preview || trimEndSeconds === null) return;

    if (preview.currentTime >= trimEndSeconds) {
      preview.pause();
      preview.currentTime = trimStartSeconds;
    }
  }}
  className="mt-4 w-full rounded-xl bg-black"
/>

           <div className="mt-4">
             <label className="mb-2 block text-sm font-medium">
               {t("reflections.coverThumbnailPosition")}
             </label>

             <input
               type="range"
               min="0"
               max="100"
               step="1"
               value={thumbnailTime}
               onChange={(event) => {
                 const value = Number(event.target.value);
                 setThumbnailTime(value);

                 const preview = previewVideoRef.current;

                 if (
                   !preview ||
                   !Number.isFinite(preview.duration) ||
                   preview.duration <= 0
                 ) {
                   return;
                 }

                 preview.pause();
                 preview.currentTime =
                   (value / 100) * preview.duration;
               }}
               className="w-full"
             />

             <p className="mt-2 text-xs text-muted-foreground">
               Cover position: {thumbnailTime}%
             </p>
           </div>
           {videoDuration > 0 && (
             <div className="mt-6 space-y-4 rounded-xl border p-4 text-left">
               <div>
                 <h3 className="font-semibold">Trim Video</h3>

                 <p className="text-sm text-muted-foreground">
                   Select the section of the video that should play.
                 </p>
               </div>

               <div>
                 <div className="mb-2 flex justify-between text-sm">
                   <span>Start</span>
                   <span>{trimStartSeconds.toFixed(1)} seconds</span>
                 </div>

                 <input
                   type="range"
                   min="0"
                   max={Math.max(videoDuration - 0.5, 0)}
                   step="0.1"
                   value={trimStartSeconds}
                   onChange={(event) => {
                     const value = Number(event.target.value);

                     const maximumStart = Math.max(
                       (trimEndSeconds ?? videoDuration) - 0.5,
                       0
                     );

                     const nextStart = Math.min(value, maximumStart);

                     setTrimStartSeconds(nextStart);

                     const preview = previewVideoRef.current;

                     if (preview) {
                       preview.pause();
                       preview.currentTime = nextStart;
                     }
                   }}
                   className="w-full"
                 />
               </div>

               <div>
                 <div className="mb-2 flex justify-between text-sm">
                   <span>End</span>
                   <span>
                     {(trimEndSeconds ?? videoDuration).toFixed(1)} seconds
                   </span>
                 </div>

                 <input
                   type="range"
                   min="0.5"
                   max={videoDuration}
                   step="0.1"
                   value={trimEndSeconds ?? videoDuration}
                   onChange={(event) => {
                     const value = Number(event.target.value);

                     const minimumEnd = Math.min(
                       trimStartSeconds + 0.5,
                       videoDuration
                     );

                     const nextEnd = Math.max(value, minimumEnd);

                     setTrimEndSeconds(nextEnd);

                     const preview = previewVideoRef.current;

                     if (preview) {
                       preview.pause();
                       preview.currentTime = nextEnd;
                     }
                   }}
                   className="w-full"
                 />
               </div>

               <div className="flex flex-col gap-2 sm:flex-row">
                 <Button
                   type="button"
                   variant="outline"
                   className="flex-1"
                   onClick={() => {
                     const preview = previewVideoRef.current;

                     if (!preview) return;

                     preview.currentTime = trimStartSeconds;
                     void preview.play();
                   }}
                 >
                   Preview Trim
                 </Button>

                 <Button
                   type="button"
                   variant="outline"
                   className="flex-1"
                   onClick={() => {
                     setTrimStartSeconds(0);
                     setTrimEndSeconds(videoDuration);

                     const preview = previewVideoRef.current;

                     if (preview) {
                       preview.pause();
                       preview.currentTime = 0;
                     }
                   }}
                 >
                   Reset Trim
                 </Button>
               </div>

               <p className="text-center text-sm text-muted-foreground">
                 Selected length:{" "}
                 {Math.max(
                   (trimEndSeconds ?? videoDuration) - trimStartSeconds,
                   0
                 ).toFixed(1)}{" "}
                 seconds
               </p>
             </div>
           )}
              </>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label
                htmlFor={cameraInputId}
                className="flex cursor-pointer items-center justify-center rounded-xl bg-islamic-green px-4 py-3 text-sm font-semibold text-white hover:bg-islamic-green/90"
              >
                <Camera className="mr-2 h-4 w-4" />
                {t("reflections.recordVideo")}
              </label>

              <label
                htmlFor={galleryInputId}
                className="flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {t("reflections.chooseFromGallery")}
              </label>

              <input
                id={cameraInputId}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleVideoChange}
                className="hidden"
              />

              <input
                id={galleryInputId}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t("reflections.titleLabel")}
              </label>

              <span className="text-xs text-muted-foreground">
                {title.length}/100
              </span>
            </div>

            <Input
              value={title}
              onChange={(event) =>
                setTitle(event.target.value.slice(0, 100))
              }
              placeholder={t("reflections.titlePlaceholder")}
              className="mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t("reflections.captionLabel")}
              </label>

              <span className="text-xs text-muted-foreground">
                {caption.length}/500
              </span>
            </div>

            <Textarea
              value={caption}
              onChange={(event) =>
                setCaption(event.target.value.slice(0, 500))
              }
              placeholder={t("reflections.captionPlaceholder")}
              className="mt-2 min-h-[120px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">
                {t("reflections.categoryLabel")}
              </label>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(
                      `reflections.categories.${value
                        .toLowerCase()
                        .replaceAll(" ", "")}`
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">
                {t("reflections.languageLabel")}
              </label>

              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {SUPPORTED_LANGUAGES.map((supportedLanguage) => (
                  <option
                    key={supportedLanguage.code}
                    value={supportedLanguage.name}
                  >
                    {supportedLanguage.flag} {supportedLanguage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
<div className="space-y-4 rounded-xl border bg-muted/20 p-4">
  <div>
    <label className="text-sm font-medium">
      Quran or Hadith Reference
    </label>

    <select
      value={referenceType}
      onChange={(event) => {
        const value = event.target.value as
          | ""
          | "quran"
          | "hadith";

        setReferenceType(value);
      }}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      <option value="">No reference</option>
      <option value="quran">Quran</option>
      <option value="hadith">Hadith</option>
    </select>
  </div>

  {referenceType === "quran" && (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="text-sm font-medium">
          Surah Number
        </label>

        <Input
          type="number"
          min="1"
          max="114"
          value={quranSurahNumber}
          onChange={(event) =>
            setQuranSurahNumber(event.target.value)
          }
          placeholder="1–114"
          className="mt-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Starting Ayah
        </label>

        <Input
          type="number"
          min="1"
          value={quranAyahStart}
          onChange={(event) =>
            setQuranAyahStart(event.target.value)
          }
          placeholder="Example: 35"
          className="mt-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Ending Ayah
        </label>

        <Input
          type="number"
          min="1"
          value={quranAyahEnd}
          onChange={(event) =>
            setQuranAyahEnd(event.target.value)
          }
          placeholder="Optional"
          className="mt-2"
        />
      </div>
    </div>
  )}

  {referenceType === "hadith" && (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium">
          Hadith Collection
        </label>

        <Input
          value={hadithCollection}
          onChange={(event) =>
            setHadithCollection(event.target.value)
          }
          placeholder="Example: Sahih al-Bukhari"
          className="mt-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Hadith Number
        </label>

        <Input
          value={hadithNumber}
          onChange={(event) =>
            setHadithNumber(event.target.value)
          }
          placeholder="Example: 6474"
          className="mt-2"
        />
      </div>
    </div>
  )}

  {referenceType && (
    <div>
      <label className="text-sm font-medium">
        Reference Note
      </label>

      <Textarea
        value={referenceNote}
        onChange={(event) =>
          setReferenceNote(event.target.value.slice(0, 300))
        }
        placeholder="Optional explanation or additional reference details"
        className="mt-2 min-h-[90px]"
      />

      <p className="mt-1 text-right text-xs text-muted-foreground">
        {referenceNote.length}/300
      </p>
    </div>
  )}
</div>
<div className="space-y-4 rounded-xl border bg-muted/20 p-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 className="font-semibold">Video Captions</h3>

      <p className="text-sm text-muted-foreground">
        Generate captions automatically or edit the caption text manually.
      </p>
    </div>

    <Button
      type="button"
      variant="outline"
      onClick={() => void handleGenerateCaptions()}
      disabled={
        generatingCaptions ||
        uploading ||
        loadingReflection ||
        (!workingReflectionId &&
          (!videoFile || !title.trim()))
      }
    >
      {generatingCaptions
        ? "Generating Captions..."
        : "Generate Captions"}
    </Button>
  </div>

  {!workingReflectionId && (
    <p className="rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
      When you generate captions, this reflection will be saved
      automatically as a draft. You will remain on this page.
    </p>
  )}

  <div>
    <label className="text-sm font-medium">
      Caption Language
    </label>

    <select
      value={captionsLanguage}
      onChange={(event) =>
        setCaptionsLanguage(event.target.value)
      }
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      {SUPPORTED_LANGUAGES.map((supportedLanguage) => (
        <option
          key={supportedLanguage.code}
          value={supportedLanguage.name}
        >
          {supportedLanguage.flag} {supportedLanguage.name}
        </option>
      ))}
    </select>
  </div>

  <div>
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">
        Caption Text
      </label>

      <span className="text-xs text-muted-foreground">
        {captionsText.length}/5000
      </span>
    </div>

    <Textarea
      value={captionsText}
      onChange={(event) =>
        setCaptionsText(event.target.value.slice(0, 5000))
      }
      placeholder="Generated or manually entered captions will appear here."
      className="mt-2 min-h-[160px]"
    />
  </div>

  <label className="flex items-center gap-3 rounded-lg border bg-background p-3">
    <input
      type="checkbox"
      checked={captionsEnabled}
      disabled={!captionsText.trim()}
      onChange={(event) =>
        setCaptionsEnabled(event.target.checked)
      }
      className="h-4 w-4"
    />

    <span>
      <span className="block text-sm font-medium">
        Display captions on the video
      </span>

      <span className="block text-xs text-muted-foreground">
        Viewers will be able to see the caption text during playback.
      </span>
    </span>
  </label>
</div>

    {uploading && (
            <div className="space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-islamic-green transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {t("reflections.uploadingProgress", {
                  progress: uploadProgress,
                })}
              </p>
            </div>
          )}


<div className="space-y-4 rounded-xl border bg-muted/20 p-4">
  <div>
    <h3 className="font-semibold">AI Caption Translation</h3>

    <p className="text-sm text-muted-foreground">
      Translate the timed captions while preserving their original
      playback timing.
    </p>
  </div>

  <div>
    <label className="text-sm font-medium">
      Translation Language
    </label>

    <select
      value={translationLanguage}
      onChange={(event) => {
        setTranslationLanguage(event.target.value);
        setTranslatedText("");
        setTranslatedLanguageName("");
      }}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      <option value="en">🇺🇸 English</option>
      <option value="ar">🇸🇦 Arabic</option>
      <option value="fr">🇫🇷 French</option>
      <option value="ha">🇳🇬 Hausa</option>
      <option value="yo">🇳🇬 Yorùbá</option>
    </select>
  </div>

 <div className="space-y-2">
   <Button
     type="button"
     onClick={() => void handleGenerateAllTranslations()}
     disabled={
       generatingTranslation ||
       generatingCaptions ||
       uploading ||
       loadingReflection ||
       !workingReflectionId ||
       !captionsText.trim()
     }
     className="w-full"
   >
     {generatingTranslation
       ? translationProgress || "Generating Translations..."
       : "Translate to Arabic, French, Hausa, and Yoruba"}
   </Button>

   <Button
     type="button"
     variant="outline"
     onClick={() => void handleGenerateTranslation()}
     disabled={
       generatingTranslation ||
       generatingCaptions ||
       uploading ||
       loadingReflection ||
       !workingReflectionId ||
       !captionsText.trim()
     }
     className="w-full"
   >
     Generate Selected Language Only
   </Button>
 </div>

  {!workingReflectionId && (
    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
      Generate captions first. The reflection will be saved
      automatically as a draft without leaving this page.
    </p>
  )}

  {workingReflectionId && !captionsText.trim() && (
    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
      Generate timed captions first. The translation will use those
      caption segments and preserve their timestamps.
    </p>
  )}

  <div>
    <div className="mb-2 flex items-center justify-between">
      <label className="text-sm font-medium">
        {translatedLanguageName || "Translation"} Preview
      </label>

      {translatedText && (
        <span className="text-xs text-muted-foreground">
          Saved automatically
        </span>
      )}
    </div>

    <Textarea
      value={translatedText}
      readOnly
      placeholder="The generated translation will appear here."
      className="min-h-[160px] bg-background"
    />

    <p className="mt-2 text-xs text-muted-foreground">
      {translatedText
        ? "The translated timed segments were saved to this reflection."
        : "Select a language and generate a translation."}
    </p>
  </div>

</div>

<div className="space-y-4 rounded-xl border bg-muted/20 p-4">
  <div>
    <h3 className="font-semibold">Schedule Posting</h3>

    <p className="text-sm text-muted-foreground">
      Choose a future date and time for this reflection.
    </p>
  </div>

  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={scheduleEnabled}
      onChange={(event) => {
        const enabled = event.target.checked;
        setScheduleEnabled(enabled);

        if (!enabled) {
          setScheduledAt("");
        }
      }}
      className="h-4 w-4"
    />

    <span className="text-sm font-medium">
      Schedule this reflection
    </span>
  </label>

  {scheduleEnabled && (
    <div>
      <label className="text-sm font-medium">
        Publication Date and Time
      </label>

      <input
        type="datetime-local"
        value={scheduledAt}
        onChange={(event) => setScheduledAt(event.target.value)}
        min={new Date(Date.now() + 60 * 1000)
          .toISOString()
          .slice(0, 16)}
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
      />

      <p className="mt-2 text-xs text-muted-foreground">
        The time uses your device’s local timezone.
      </p>
    </div>
  )}
</div>

  <div className="flex flex-col gap-3 sm:flex-row">
    <Button
      type="button"
      variant="outline"
      disabled={
        uploading ||
        loadingReflection ||
        (!videoFile && !existingVideoUrl) ||
        !title.trim()
      }
      onClick={() => void handleSubmit("draft")}
      className="flex-1"
      size="lg"
    >
      {isEditing ? "Update Draft" : "Save as Draft"}
    </Button>

    <Button
      type="button"
      onClick={() => void handleSubmit("pending")}
      disabled={
        uploading ||
        loadingReflection ||
        scheduleEnabled ||
        (!videoFile && !existingVideoUrl) ||
        !title.trim()
      }
      className="flex-1"
      size="lg"
    >
      {uploading
        ? t("reflections.uploading")
        : isEditing
          ? "Submit Changes for Review"
          : t("reflections.postReflection")}
    </Button>
    <Button
      type="button"
      variant="secondary"
      onClick={() => void handleSubmit("scheduled")}
      disabled={
        uploading ||
        loadingReflection ||
        (!videoFile && !existingVideoUrl) ||
        !title.trim() ||
        !scheduleEnabled ||
        !scheduledAt
      }
      className="flex-1"
      size="lg"
    >
      {uploading
        ? "Scheduling..."
        : scheduleEnabled && scheduledAt
          ? "Confirm Scheduled Posting"
          : "Schedule Reflection"}
          </Button>
  </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("reflections.reviewNotice")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
