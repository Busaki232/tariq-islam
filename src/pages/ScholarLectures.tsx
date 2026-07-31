import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  FileEdit,
  Languages,
  ListVideo,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type LectureStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

type FilterValue = "all" | LectureStatus;

type ScholarRecord = {
  id: string;
  user_id: string;
  display_name: string;
  verification_status: string;
  is_active: boolean;
};

type ScholarLecture = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  is_featured: boolean;
  status: LectureStatus;
  created_at: string;
  updated_at: string | null;
  captions_enabled: boolean;
  captions_language: string | null;
  captions_text: string | null;
  captions_segments: unknown[] | null;
};

type AudioTranslationStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "cancelled";

type CaptionTranslationOption = {
  id: string;
  lecture_id: string;
  language_code: string;
  language_name: string;
  updated_at: string | null;
};

type AudioTranslationJob = {
  id: string;
  lecture_id: string;
  language_code: string;
  language_name: string;
  status: AudioTranslationStatus;
  storage_path: string | null;
  error_message: string | null;
  updated_at: string;
};

const getAudioJobKey = (
  lectureId: string,
  languageCode: string
) => `${lectureId}:${languageCode}`;

const TRANSLATION_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "ha", name: "Hausa" },
  { code: "yo", name: "Yorùbá" },
] as const;

const ScholarLectures = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [scholar, setScholar] = useState<ScholarRecord | null>(null);
  const [lectures, setLectures] = useState<ScholarLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<FilterValue>("all");

  const [updatingLectureId, setUpdatingLectureId] =
    useState<string | null>(null);
  const [deletingLectureId, setDeletingLectureId] =
    useState<string | null>(null);
  const [
    generatingCaptionsLectureId,
    setGeneratingCaptionsLectureId,
  ] = useState<string | null>(null);
  const [translatingLectureId, setTranslatingLectureId] =
    useState<string | null>(null);

  const [
    captionTranslationOptions,
    setCaptionTranslationOptions,
  ] = useState<
    Record<string, CaptionTranslationOption[]>
  >({});

  const [audioTranslationJobs, setAudioTranslationJobs] =
    useState<Record<string, AudioTranslationJob>>({});

  const [
    selectedVoiceLanguages,
    setSelectedVoiceLanguages,
  ] = useState<Record<string, string>>({});

  const [
    queueingVoiceLectureId,
    setQueueingVoiceLectureId,
  ] = useState<string | null>(null);

  const loadLectures = useCallback(
    async (showRefreshIndicator = false) => {
      if (!scholarId || !user?.id) {
        setLoading(false);
        return;
      }

      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { data: scholarData, error: scholarError } =
          await supabase
            .from("scholar_profiles")
            .select(
              `
                id,
                user_id,
                display_name,
                verification_status,
                is_active
              `
            )
            .eq("id", scholarId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (scholarError) {
          throw scholarError;
        }

        if (!scholarData) {
          setScholar(null);
          setLectures([]);
          return;
        }

        setScholar(scholarData as ScholarRecord);

        const { data: lectureData, error: lectureError } =
          await supabase
            .from("scholar_lectures")
            .select(
              `
                id,
                scholar_id,
                title,
                description,
                video_url,
                thumbnail_url,
                category,
                language,
                is_featured,
                status,
                created_at,
                updated_at,
                captions_enabled,
                captions_language,
                captions_text,
                captions_segments
              `
            )
            .eq("scholar_id", scholarId)
            .order("created_at", { ascending: false });

        if (lectureError) {
          throw lectureError;
        }

        const loadedLectures =
          (lectureData ?? []) as ScholarLecture[];

        setLectures(loadedLectures);

        const lectureIds = loadedLectures.map(
          (lecture) => lecture.id
        );

        if (lectureIds.length === 0) {
          setCaptionTranslationOptions({});
          setAudioTranslationJobs({});
        } else {
          const [
            { data: translationData, error: translationError },
            { data: audioData, error: audioError },
          ] = await Promise.all([
            supabase
              .from("scholar_lecture_caption_translations")
              .select(
                "id,lecture_id,language_code,language_name,updated_at"
              )
              .in("lecture_id", lectureIds)
              .order("language_name", {
                ascending: true,
              }),
            supabase
              .from("scholar_lecture_audio_translations")
              .select(
                "id,lecture_id,language_code,language_name,status,storage_path,error_message,updated_at"
              )
              .in("lecture_id", lectureIds),
          ]);

          if (translationError) {
            throw translationError;
          }

          if (audioError) {
            throw audioError;
          }

          const translationsByLecture: Record<
            string,
            CaptionTranslationOption[]
          > = {};

          for (const row of translationData ?? []) {
            const current =
              translationsByLecture[row.lecture_id] ?? [];

            current.push(
              row as CaptionTranslationOption
            );

            translationsByLecture[row.lecture_id] =
              current;
          }

          const jobsByKey: Record<
            string,
            AudioTranslationJob
          > = {};

          for (const row of audioData ?? []) {
            jobsByKey[
              getAudioJobKey(
                row.lecture_id,
                row.language_code
              )
            ] = row as AudioTranslationJob;
          }

          setCaptionTranslationOptions(
            translationsByLecture
          );
          setAudioTranslationJobs(jobsByKey);
        }
      } catch (error: any) {
        console.error("Unable to load scholar lectures:", error);

        toast({
          title: t("scholars.lectureManager.loadError", {
            defaultValue: "Unable to load lectures",
          }),
          description:
            error?.message ||
            t("scholars.lectureManager.loadErrorDescription", {
              defaultValue: "Your lectures could not be loaded.",
            }),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scholarId, user?.id, toast, t]
  );

  useEffect(() => {
    void loadLectures();
  }, [loadLectures]);

  const queueVoiceTranslation = async (
    lecture: ScholarLecture,
    languageCode: string
  ) => {
    if (
      !languageCode ||
      queueingVoiceLectureId
    ) {
      return;
    }

    try {
      setQueueingVoiceLectureId(lecture.id);

      const { data, error } =
        await supabase.functions.invoke(
          "queue-scholar-voice-translation",
          {
            body: {
              lectureId: lecture.id,
              targetLanguageCode: languageCode,
            },
          }
        );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const job = data?.job as
        | AudioTranslationJob
        | undefined;

      if (job) {
        setAudioTranslationJobs((current) => ({
          ...current,
          [getAudioJobKey(
            job.lecture_id,
            job.language_code
          )]: job,
        }));
      }

      toast({
        title: t(
          "scholars.lectureManager.voiceQueued",
          {
            defaultValue:
              "Voice translation queued",
          }
        ),
        description: t(
          "scholars.lectureManager.voiceQueuedDescription",
          {
            defaultValue:
              "The audio job is ready for processing when the voice provider becomes available.",
          }
        ),
      });
    } catch (error: any) {
      console.error(
        "Unable to queue voice translation:",
        error
      );

      toast({
        title: t(
          "scholars.lectureManager.voiceQueueError",
          {
            defaultValue:
              "Unable to queue voice translation",
          }
        ),
        description:
          error?.message ||
          "Please verify your voice enrollment and try again.",
        variant: "destructive",
      });
    } finally {
      setQueueingVoiceLectureId(null);
    }
  };

  const lectureCounts = useMemo(() => {
    return {
      all: lectures.length,
      draft: lectures.filter(
        (lecture) => lecture.status === "draft"
      ).length,
      pending: lectures.filter(
        (lecture) => lecture.status === "pending"
      ).length,
      approved: lectures.filter(
        (lecture) => lecture.status === "approved"
      ).length,
      rejected: lectures.filter(
        (lecture) => lecture.status === "rejected"
      ).length,
      archived: lectures.filter(
        (lecture) => lecture.status === "archived"
      ).length,
    };
  }, [lectures]);

  const filteredLectures = useMemo(() => {
    if (activeFilter === "all") {
      return lectures;
    }

    return lectures.filter(
      (lecture) => lecture.status === activeFilter
    );
  }, [activeFilter, lectures]);

  const getStatusBadge = (status: LectureStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-600 hover:bg-green-600">
            {t("scholars.lectureManager.status.approved", {
              defaultValue: "Approved",
            })}
          </Badge>
        );

      case "pending":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500">
            {t("scholars.lectureManager.status.pending", {
              defaultValue: "Pending Review",
            })}
          </Badge>
        );

      case "rejected":
        return (
          <Badge variant="destructive">
            {t("scholars.lectureManager.status.rejected", {
              defaultValue: "Rejected",
            })}
          </Badge>
        );

      case "archived":
        return (
          <Badge variant="secondary">
            {t("scholars.lectureManager.status.archived", {
              defaultValue: "Archived",
            })}
          </Badge>
        );

      default:
        return (
          <Badge variant="outline">
            {t("scholars.lectureManager.status.draft", {
              defaultValue: "Draft",
            })}
          </Badge>
        );
    }
  };

  const getStatusLabel = (status: FilterValue) => {
    switch (status) {
      case "draft":
        return t("scholars.lectureManager.status.draft", {
          defaultValue: "Draft",
        });
      case "pending":
        return t(
          "scholars.lectureManager.status.pendingShort",
          { defaultValue: "Pending" }
        );
      case "approved":
        return t(
          "scholars.lectureManager.status.approved",
          { defaultValue: "Approved" }
        );
      case "rejected":
        return t(
          "scholars.lectureManager.status.rejected",
          { defaultValue: "Rejected" }
        );
      case "archived":
        return t(
          "scholars.lectureManager.status.archived",
          { defaultValue: "Archived" }
        );
      default:
        return "";
    }
  };

  const generateLectureCaptions = async (
    lecture: ScholarLecture
  ) => {
    if (
      generatingCaptionsLectureId ||
      translatingLectureId
    ) {
      return;
    }

    try {
      setGeneratingCaptionsLectureId(lecture.id);

      const { data, error } =
        await supabase.functions.invoke(
          "generate-scholar-lecture-captions",
          {
            body: { lectureId: lecture.id },
          }
        );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setLectures((current) =>
        current.map((item) =>
          item.id === lecture.id
            ? {
                ...item,
                captions_enabled: true,
                captions_language:
                  data?.captionsLanguage ||
                  lecture.language ||
                  "original",
                captions_text: data?.captionsText || "",
                captions_segments: Array.isArray(
                  data?.captionsSegments
                )
                  ? data.captionsSegments
                  : [],
              }
            : item
        )
      );

      toast({
        title: t(
          "scholars.lectureManager.captionsGenerated",
          { defaultValue: "Captions generated" }
        ),
        description: t(
          "scholars.lectureManager.captionsGeneratedDescription",
          {
            defaultValue:
              "Timed captions are now available for this lecture.",
          }
        ),
      });
    } catch (error: any) {
      console.error(
        "Scholar lecture caption generation failed:",
        error
      );

      toast({
        title: t(
          "scholars.lectureManager.captionGenerationError",
          { defaultValue: "Caption generation failed" }
        ),
        description:
          error?.message ||
          t(
            "scholars.lectureManager.captionGenerationErrorDescription",
            {
              defaultValue:
                "Captions could not be generated for this lecture.",
            }
          ),
        variant: "destructive",
      });
    } finally {
      setGeneratingCaptionsLectureId(null);
    }
  };

  const translateAllLectureCaptions = async (
    lecture: ScholarLecture
  ) => {
    if (
      generatingCaptionsLectureId ||
      translatingLectureId
    ) {
      return;
    }

    if (!lecture.captions_enabled) {
      toast({
        title: t(
          "scholars.lectureManager.generateCaptionsFirst",
          {
            defaultValue: "Generate captions first",
          }
        ),
        description: t(
          "scholars.lectureManager.generateCaptionsFirstDescription",
          {
            defaultValue:
              "Original timed captions are required before translation.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    try {
      setTranslatingLectureId(lecture.id);

      const translationResults =
        await Promise.allSettled(
          TRANSLATION_LANGUAGES.map(
            async (languageOption) => {
              const { data, error } =
                await supabase.functions.invoke(
                  "translate-scholar-lecture-captions",
                  {
                    body: {
                      lectureId: lecture.id,
                      targetLanguageCode:
                        languageOption.code,
                    },
                  }
                );

              if (error) {
                throw new Error(
                  `${languageOption.name}: ${
                    error.message ||
                    "Translation request failed."
                  }`
                );
              }

              if (data?.error) {
                throw new Error(
                  `${languageOption.name}: ${data.error}`
                );
              }

              return languageOption;
            }
          )
        );

      const successfulLanguages =
        translationResults
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<
              (typeof TRANSLATION_LANGUAGES)[number]
            > => result.status === "fulfilled"
          )
          .map(
            (result) => result.value.name
          );

      const failedTranslations =
        translationResults.filter(
          (
            result
          ): result is PromiseRejectedResult =>
            result.status === "rejected"
        );

      if (failedTranslations.length > 0) {
        const failureMessage =
          failedTranslations
            .map((result) =>
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
            )
            .join(" | ");

        if (successfulLanguages.length === 0) {
          throw new Error(failureMessage);
        }

        toast({
          title: t(
            "scholars.lectureManager.partialTranslationSuccess",
            {
              defaultValue:
                "Some translations were generated",
            }
          ),
          description:
            `${successfulLanguages.join(
              ", "
            )} completed. ${failureMessage}`,
          variant: "destructive",
        });

        return;
      }

      toast({
        title: t(
          "scholars.lectureManager.translationsGenerated",
          {
            defaultValue:
              "Translations generated",
          }
        ),
        description: t(
          "scholars.lectureManager.translationsGeneratedDescription",
          {
            defaultValue:
              "Arabic, French, and Hausa captions are now available.",
          }
        ),
      });
    } catch (error: any) {
      console.error(
        "Scholar lecture translations failed:",
        error
      );

      toast({
        title: t(
          "scholars.lectureManager.translationError",
          {
            defaultValue: "Translation failed",
          }
        ),
        description:
          error?.message ||
          t(
            "scholars.lectureManager.translationErrorDescription",
            {
              defaultValue:
                "The lecture captions could not be translated.",
            }
          ),
        variant: "destructive",
      });
    } finally {
      setTranslatingLectureId(null);
    }
  };

  const submitForReview = async (
    lectureId: string
  ) => {
    try {
      setUpdatingLectureId(lectureId);

      const { error } = await supabase
        .from("scholar_lectures")
        .update({ status: "pending" })
        .eq("id", lectureId)
        .eq("scholar_id", scholarId);

      if (error) {
        throw error;
      }

      setLectures((current) =>
        current.map((lecture) =>
          lecture.id === lectureId
            ? { ...lecture, status: "pending" }
            : lecture
        )
      );

      toast({
        title: t(
          "scholars.lectureManager.submitted",
          { defaultValue: "Lecture submitted" }
        ),
        description: t(
          "scholars.lectureManager.submittedDescription",
          {
            defaultValue:
              "The lecture has been submitted for administrator review.",
          }
        ),
      });
    } catch (error: any) {
      console.error("Lecture submission failed:", error);

      toast({
        title: t(
          "scholars.lectureManager.submitError",
          { defaultValue: "Submission failed" }
        ),
        description:
          error?.message ||
          t(
            "scholars.lectureManager.submitErrorDescription",
            {
              defaultValue:
                "The lecture could not be submitted.",
            }
          ),
        variant: "destructive",
      });
    } finally {
      setUpdatingLectureId(null);
    }
  };

  const deleteLecture = async (
    lecture: ScholarLecture
  ) => {
    const confirmed = window.confirm(
      t("scholars.lectureManager.deleteConfirm", {
        title: lecture.title,
        defaultValue:
          'Delete "{{title}}" permanently? This action cannot be undone.',
      })
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingLectureId(lecture.id);

      const { error } = await supabase
        .from("scholar_lectures")
        .delete()
        .eq("id", lecture.id)
        .eq("scholar_id", scholarId);

      if (error) {
        throw error;
      }

      setLectures((current) =>
        current.filter(
          (item) => item.id !== lecture.id
        )
      );

      toast({
        title: t(
          "scholars.lectureManager.deleted",
          { defaultValue: "Lecture deleted" }
        ),
        description: t(
          "scholars.lectureManager.deletedDescription",
          {
            defaultValue:
              "The lecture was permanently deleted.",
          }
        ),
      });
    } catch (error: any) {
      console.error("Lecture deletion failed:", error);

      toast({
        title: t(
          "scholars.lectureManager.deleteError",
          { defaultValue: "Delete failed" }
        ),
        description:
          error?.message ||
          t(
            "scholars.lectureManager.deleteErrorDescription",
            {
              defaultValue:
                "The lecture could not be deleted.",
            }
          ),
        variant: "destructive",
      });
    } finally {
      setDeletingLectureId(null);
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>
            {t("scholars.lectureManager.loading", {
              defaultValue: "Loading your lectures...",
            })}
          </span>
        </div>
      </main>
    );
  }

  if (!scholar) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-semibold">
              {t(
                "scholars.lectureManager.accessRequired",
                {
                  defaultValue:
                    "Scholar access required",
                }
              )}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "scholars.lectureManager.accessRequiredDescription",
                {
                  defaultValue:
                    "You do not have permission to manage lectures for this scholar account.",
                }
              )}
            </p>
            <Button
              type="button"
              className="mt-6"
              onClick={() => navigate("/scholars")}
            >
              {t(
                "scholars.lectureManager.returnToScholars",
                {
                  defaultValue:
                    "Return to Scholars",
                }
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const renderLectureCards = () => {
    if (filteredLectures.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-medium">
            {activeFilter === "all"
              ? t(
                  "scholars.lectureManager.noLectures",
                  { defaultValue: "No lectures" }
                )
              : t(
                  "scholars.lectureManager.noStatusLectures",
                  {
                    status:
                      getStatusLabel(activeFilter),
                    defaultValue:
                      "No {{status}} lectures",
                  }
                )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFilter === "all"
              ? t(
                  "scholars.lectureManager.emptyDescription",
                  {
                    defaultValue:
                      "Upload your first lecture to get started.",
                  }
                )
              : t(
                  "scholars.lectureManager.emptyStatusDescription",
                  {
                    defaultValue:
                      "There are no lectures with this status.",
                  }
                )}
          </p>
          {activeFilter === "all" && (
            <Button
              type="button"
              className="mt-5"
              onClick={() =>
                navigate(
                  `/scholars/${scholar.id}/lectures/new`
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t(
                "scholars.lectureManager.addLecture",
                { defaultValue: "Add Lecture" }
              )}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLectures.map((lecture) => {
          const canModify =
            lecture.status === "draft" ||
            lecture.status === "rejected";
          const isUpdating =
            updatingLectureId === lecture.id;
          const isDeleting =
            deletingLectureId === lecture.id;
          const isGeneratingCaptions =
            generatingCaptionsLectureId ===
            lecture.id;
          const isTranslating =
            translatingLectureId === lecture.id;
          const isAiProcessing =
            isGeneratingCaptions ||
            isTranslating;

          const voiceLanguages =
            captionTranslationOptions[lecture.id] ?? [];

          const selectedVoiceLanguage =
            selectedVoiceLanguages[lecture.id] ??
            voiceLanguages[0]?.language_code ??
            "";

          const selectedVoiceJob =
            selectedVoiceLanguage
              ? audioTranslationJobs[
                  getAudioJobKey(
                    lecture.id,
                    selectedVoiceLanguage
                  )
                ]
              : undefined;

          const isQueueingVoice =
            queueingVoiceLectureId === lecture.id;

          return (
            <Card
              key={lecture.id}
              className="overflow-hidden"
            >
              <div className="relative aspect-video bg-muted">
                {lecture.thumbnail_url ? (
                  <img
                    src={lecture.thumbnail_url}
                    alt={lecture.title}
                    className="h-full w-full object-cover"
                  />
                ) : lecture.video_url ? (
                  <video
                    src={lecture.video_url}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute left-3 top-3">
                  {getStatusBadge(lecture.status)}
                </div>
              </div>

              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="line-clamp-2 font-semibold">
                    {lecture.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "scholars.lectureManager.createdDate",
                      {
                        date: formatDate(
                          lecture.created_at
                        ),
                        defaultValue:
                          "Created {{date}}",
                      }
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {lecture.category && (
                    <Badge variant="secondary">
                      {lecture.category}
                    </Badge>
                  )}
                  {lecture.language && (
                    <Badge variant="outline">
                      {lecture.language}
                    </Badge>
                  )}
                  {lecture.is_featured && (
                    <Badge>
                      {t(
                        "scholars.lectureManager.featured",
                        { defaultValue: "Featured" }
                      )}
                    </Badge>
                  )}
                  {lecture.captions_enabled ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      {t(
                        "scholars.lectureManager.captionsReady",
                        {
                          defaultValue:
                            "Captions Ready",
                        }
                      )}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t(
                        "scholars.lectureManager.noCaptions",
                        {
                          defaultValue:
                            "No Captions",
                        }
                      )}
                    </Badge>
                  )}
                </div>

                {lecture.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {lecture.description}
                  </p>
                )}

                {lecture.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    {t(
                      "scholars.lectureManager.rejectedNotice",
                      {
                        defaultValue:
                          "This lecture was rejected. Edit it before resubmitting it for review.",
                      }
                    )}
                  </div>
                )}

                {lecture.status === "pending" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    {t(
                      "scholars.lectureManager.pendingNotice",
                      {
                        defaultValue:
                          "This lecture is awaiting administrator review.",
                      }
                    )}
                  </div>
                )}

                <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {t(
                        "scholars.lectureManager.aiCaptions",
                        {
                          defaultValue:
                            "AI Captions & Translation",
                        }
                      )}
                    </p>
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    variant={
                      lecture.captions_enabled
                        ? "outline"
                        : "default"
                    }
                    disabled={isAiProcessing}
                    onClick={() =>
                      void generateLectureCaptions(
                        lecture
                      )
                    }
                  >
                    {isGeneratingCaptions ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {lecture.captions_enabled
                      ? t(
                          "scholars.lectureManager.regenerateCaptions",
                          {
                            defaultValue:
                              "Regenerate Captions",
                          }
                        )
                      : t(
                          "scholars.lectureManager.generateCaptions",
                          {
                            defaultValue:
                              "Generate Captions",
                          }
                        )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={
                      !lecture.captions_enabled ||
                      isAiProcessing
                    }
                    onClick={() =>
                      void translateAllLectureCaptions(
                        lecture
                      )
                    }
                  >
                    {isTranslating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Languages className="mr-2 h-4 w-4" />
                    )}

                    {t(
                      "scholars.lectureManager.translateAll",
                      {
                        defaultValue: "Translate All",
                      }
                    )}
                  </Button>

                  {!lecture.captions_enabled && (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "scholars.lectureManager.generateBeforeTranslate",
                        {
                          defaultValue:
                            "Generate the original captions before translating.",
                        }
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {t(
                        "scholars.lectureManager.voiceTranslation",
                        {
                          defaultValue:
                            "AI Voice Translation",
                        }
                      )}
                    </p>

                    {selectedVoiceJob && (
                      <Badge
                        className={
                          selectedVoiceJob.status === "ready"
                            ? "ml-auto bg-emerald-600 hover:bg-emerald-600"
                            : selectedVoiceJob.status === "failed"
                              ? "ml-auto bg-destructive hover:bg-destructive"
                              : selectedVoiceJob.status === "processing"
                                ? "ml-auto bg-blue-600 hover:bg-blue-600"
                                : "ml-auto bg-amber-500 hover:bg-amber-500"
                        }
                      >
                        {selectedVoiceJob.status === "queued"
                          ? "Queued"
                          : selectedVoiceJob.status ===
                              "processing"
                            ? "Processing"
                            : selectedVoiceJob.status ===
                                "ready"
                              ? "Ready"
                              : selectedVoiceJob.status ===
                                  "failed"
                                ? "Failed"
                                : "Cancelled"}
                      </Badge>
                    )}
                  </div>

                  {voiceLanguages.length > 0 ? (
                    <>
                      <select
                        value={selectedVoiceLanguage}
                        onChange={(event) =>
                          setSelectedVoiceLanguages(
                            (current) => ({
                              ...current,
                              [lecture.id]:
                                event.target.value,
                            })
                          )
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        aria-label="Voice translation language"
                      >
                        {voiceLanguages.map(
                          (languageOption) => (
                            <option
                              key={languageOption.language_code}
                              value={
                                languageOption.language_code
                              }
                            >
                              {languageOption.language_name}
                            </option>
                          )
                        )}
                      </select>

                      <Button
                        type="button"
                        className="w-full"
                        disabled={
                          isQueueingVoice ||
                          isAiProcessing ||
                          !selectedVoiceLanguage ||
                          selectedVoiceJob?.status ===
                            "processing"
                        }
                        onClick={() =>
                          void queueVoiceTranslation(
                            lecture,
                            selectedVoiceLanguage
                          )
                        }
                      >
                        {isQueueingVoice ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="mr-2 h-4 w-4" />
                        )}

                        {selectedVoiceJob
                          ? t(
                              "scholars.lectureManager.refreshVoiceTranslation",
                              {
                                defaultValue:
                                  "Refresh Voice Translation",
                              }
                            )
                          : t(
                              "scholars.lectureManager.generateVoiceTranslation",
                              {
                                defaultValue:
                                  "Generate Voice Translation",
                              }
                            )}
                      </Button>

                      {selectedVoiceJob?.error_message && (
                        <p className="text-xs text-destructive">
                          {selectedVoiceJob.error_message}
                        </p>
                      )}

                      {selectedVoiceJob?.status ===
                        "queued" && (
                        <p className="text-xs text-muted-foreground">
                          OpenAI Custom Voice access is
                          pending. No recording has been
                          transmitted.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Generate caption translations before
                      creating translated audio.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        navigate(
                          `/scholars/${lecture.scholar_id}/lectures/${lecture.id}`
                        )
                      }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {t(
                      "scholars.lectureManager.preview",
                      { defaultValue: "Preview" }
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canModify}
                    onClick={() =>
                      navigate(
                        `/scholars/${scholar.id}/lectures/${lecture.id}/edit`
                      )
                    }
                  >
                    <FileEdit className="mr-2 h-4 w-4" />
                    {t(
                      "scholars.lectureManager.edit",
                      { defaultValue: "Edit" }
                    )}
                  </Button>
                </div>

                {canModify && (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      isUpdating ||
                      isDeleting ||
                      isAiProcessing
                    }
                    onClick={() =>
                      void submitForReview(
                        lecture.id
                      )
                    }
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {t(
                      "scholars.lectureManager.submitForReview",
                      {
                        defaultValue:
                          "Submit for Review",
                      }
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={
                    isDeleting ||
                    isUpdating ||
                    isAiProcessing
                  }
                  onClick={() =>
                    void deleteLecture(lecture)
                  }
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {t(
                    "scholars.lectureManager.delete",
                    { defaultValue: "Delete" }
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigate(`/scholars/${scholar.id}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t(
              "scholars.lectureManager.scholarProfile",
              { defaultValue: "Scholar Profile" }
            )}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() =>
                void loadLectures(true)
              }
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t(
                "scholars.lectureManager.refresh",
                { defaultValue: "Refresh" }
              )}
            </Button>

            <Button
              type="button"
              onClick={() =>
                navigate(
                  `/scholars/${scholar.id}/lectures/new`
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t(
                "scholars.lectureManager.addLecture",
                { defaultValue: "Add Lecture" }
              )}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>
                {t(
                  "scholars.lectureManager.myLectures",
                  {
                    scholar:
                      scholar.display_name,
                    defaultValue:
                      "{{scholar}} - My Lectures",
                  }
                )}
              </CardTitle>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(
                    `/scholars/${scholar.id}/playlists`
                  )
                }
              >
                <ListVideo className="mr-2 h-4 w-4" />
                {t(
                  "scholars.playlists.manage.title",
                  {
                    defaultValue:
                      "Manage Playlists",
                  }
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [
                  lectureCounts.all,
                  t(
                    "scholars.lectureManager.total",
                    { defaultValue: "Total" }
                  ),
                ],
                [
                  lectureCounts.pending,
                  t(
                    "scholars.lectureManager.status.pendingShort",
                    { defaultValue: "Pending" }
                  ),
                ],
                [
                  lectureCounts.approved,
                  t(
                    "scholars.lectureManager.status.approved",
                    { defaultValue: "Approved" }
                  ),
                ],
                [
                  lectureCounts.rejected,
                  t(
                    "scholars.lectureManager.status.rejected",
                    { defaultValue: "Rejected" }
                  ),
                ],
              ].map(([count, label]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border p-3"
                >
                  <p className="text-2xl font-bold">
                    {count}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={activeFilter}
          onValueChange={(value) =>
            setActiveFilter(
              value as FilterValue
            )
          }
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="all">
              {t(
                "scholars.lectureManager.filters.all",
                {
                  count: lectureCounts.all,
                  defaultValue:
                    "All ({{count}})",
                }
              )}
            </TabsTrigger>
            <TabsTrigger value="draft">
              {t(
                "scholars.lectureManager.filters.drafts",
                {
                  count: lectureCounts.draft,
                  defaultValue:
                    "Drafts ({{count}})",
                }
              )}
            </TabsTrigger>
            <TabsTrigger value="pending">
              {t(
                "scholars.lectureManager.filters.pending",
                {
                  count:
                    lectureCounts.pending,
                  defaultValue:
                    "Pending ({{count}})",
                }
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              {t(
                "scholars.lectureManager.filters.approved",
                {
                  count:
                    lectureCounts.approved,
                  defaultValue:
                    "Approved ({{count}})",
                }
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected">
              {t(
                "scholars.lectureManager.filters.rejected",
                {
                  count:
                    lectureCounts.rejected,
                  defaultValue:
                    "Rejected ({{count}})",
                }
              )}
            </TabsTrigger>
          </TabsList>

          {[
            "all",
            "draft",
            "pending",
            "approved",
            "rejected",
          ].map((value) => (
            <TabsContent
              key={value}
              value={value}
              className="mt-6"
            >
              {renderLectureCards()}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </main>
  );
};

export default ScholarLectures;
