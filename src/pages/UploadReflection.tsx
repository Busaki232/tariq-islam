import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { t } = useTranslation();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Daily Reminder");
  const [language, setLanguage] = useState("English");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [thumbnailTime, setThumbnailTime] = useState(0);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const galleryInputId = "reflection-gallery-input";
  const cameraInputId = "reflection-camera-input";

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
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!videoFile) {
      toast({
        title: t("reflections.videoRequired"),
        description: t("reflections.chooseVideoFirst"),
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: t("reflections.titleRequired"),
        description: t("reflections.addReflectionTitle"),
        variant: "destructive",
      });
      return;
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
      const fileExtension = videoFile.name.split(".").pop() || "mp4";
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;

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

      const videoUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from("reflection_videos")
        .insert({
          user_id: user.id,
          title: title.trim(),
          caption: caption.trim() || null,
          category,
          language,
          video_url: videoUrl,
          status: "pending",
        });

      if (insertError) throw insertError;

      setUploadProgress(100);
      setUploaded(true);

      toast({
        title: t("reflections.reflectionUploaded"),
        description: t("reflections.pendingReviewShort"),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("reflections.couldNotUpload");

      toast({
        title: t("reflections.uploadFailed"),
        description: message,
        variant: "destructive",
      });
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
                  controls
                  playsInline
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
                    value={thumbnailTime}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setThumbnailTime(value);

                      const preview = previewVideoRef.current;

                      if (preview && Number.isFinite(preview.duration)) {
                        preview.currentTime =
                          (value / 100) * preview.duration;
                      }
                    }}
                    className="w-full"
                  />
                </div>
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

          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full"
            size="lg"
          >
            {uploading
              ? t("reflections.uploading")
              : t("reflections.postReflection")}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t("reflections.reviewNotice")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}