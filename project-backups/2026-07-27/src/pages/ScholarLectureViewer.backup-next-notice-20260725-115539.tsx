import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  BookOpen,
  CalendarDays,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

type LectureRecord = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  status: string;
  created_at: string;
};

type ScholarRecord = {
  id: string;
  user_id: string;
  display_name: string;
  biography: string | null;
  country: string | null;
  city: string | null;
  verification_status: string;
  is_active: boolean;
};

type RelatedLecture = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  created_at: string;
};

type LectureComment = {
  id: string;
  lecture_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    user_id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

const ScholarLectureViewer = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { scholarId, lectureId } = useParams<{
    scholarId: string;
    lectureId: string;
  }>();
  const { toast } = useToast();
  const { user } = useAuth();

  const [lecture, setLecture] = useState<LectureRecord | null>(null);
  const [scholar, setScholar] = useState<ScholarRecord | null>(null);
  const [relatedLectures, setRelatedLectures] = useState<RelatedLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [viewCount, setViewCount] = useState(0);
  const [viewRecorded, setViewRecorded] = useState(false);

  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastProgressSaveRef = useRef(0);
  const progressLoadedRef = useRef(false);

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  const [comments, setComments] = useState<LectureComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);

  const [scholarAvatarUrl, setScholarAvatarUrl] = useState<string | null>(null);

  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveLectureProgress = useCallback(
    async (
      currentTime: number,
      duration: number,
      completed = false
    ) => {
      if (!user?.id || !lectureId) {
        return;
      }

      const safeCurrentTime = Math.max(0, Math.floor(currentTime));
      const safeDuration =
        Number.isFinite(duration) && duration > 0
          ? Math.floor(duration)
          : null;

      const { error } = await supabase
        .from("scholar_lecture_progress")
        .upsert(
          {
            lecture_id: lectureId,
            user_id: user.id,
            current_time_seconds: completed ? 0 : safeCurrentTime,
            duration_seconds: safeDuration,
            completed,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "lecture_id,user_id",
          }
        );

      if (error) {
        console.error("Unable to save lecture progress:", error);
      }
    },
    [lectureId, user?.id]
  );

  const restoreLectureProgress = useCallback(
    async (video: HTMLVideoElement) => {
      if (!user?.id || !lectureId || progressLoadedRef.current) {
        return;
      }

      progressLoadedRef.current = true;

      const { data, error } = await supabase
        .from("scholar_lecture_progress")
        .select(
          `
            current_time_seconds,
            duration_seconds,
            completed
          `
        )
        .eq("lecture_id", lectureId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Unable to restore lecture progress:", error);
        return;
      }

      if (
        data &&
        !data.completed &&
        data.current_time_seconds > 5 &&
        data.current_time_seconds < video.duration - 5
      ) {
        video.currentTime = data.current_time_seconds;
        lastProgressSaveRef.current = data.current_time_seconds;
      }
    },
    [lectureId, user?.id]
  );

  const loadLecture = useCallback(async () => {
    if (!scholarId || !lectureId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setNotFound(false);

      const { data: lectureData, error: lectureError } = await supabase
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
            status,
            created_at
          `
        )
        .eq("id", lectureId)
        .eq("scholar_id", scholarId)
        .eq("status", "approved")
        .maybeSingle();

      if (lectureError) {
        throw lectureError;
      }

      if (!lectureData) {
        setNotFound(true);
        return;
      }

      setLecture(lectureData as LectureRecord);

      const { count: lectureViewCount, error: viewCountError } =
        await supabase
          .from("scholar_lecture_views")
          .select("id", { count: "exact", head: true })
          .eq("lecture_id", lectureData.id);

      if (viewCountError) {
        console.error("Unable to load lecture view count:", viewCountError);
      } else {
        setViewCount(lectureViewCount ?? 0);
      }

      if (user?.id) {
        const { data: savedRow, error: savedError } = await supabase
          .from("scholar_lecture_saves")
          .select("id")
          .eq("lecture_id", lectureData.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (savedError) {
          console.error("Unable to load saved lecture status:", savedError);
        }

        setIsSaved(Boolean(savedRow));
      } else {
        setIsSaved(false);
      }

      const { count: lectureLikeCount, error: likeCountError } =
        await supabase
          .from("scholar_lecture_likes")
          .select("id", { count: "exact", head: true })
          .eq("lecture_id", lectureData.id);

      if (likeCountError) {
        console.error("Unable to load lecture like count:", likeCountError);
      } else {
        setLikeCount(lectureLikeCount ?? 0);
      }

      if (user?.id) {
        const { data: existingLike, error: existingLikeError } =
          await supabase
            .from("scholar_lecture_likes")
            .select("id")
            .eq("lecture_id", lectureData.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (existingLikeError) {
          console.error("Unable to check lecture like:", existingLikeError);
        } else {
          setIsLiked(Boolean(existingLike));
        }
      } else {
        setIsLiked(false);
      }

      const [scholarResult, relatedResult] = await Promise.all([
        supabase
          .from("scholar_profiles")
          .select(
            `
              id,
              user_id,
              display_name,
              biography,
              country,
              city,
              verification_status,
              is_active
            `
          )
          .eq("id", scholarId)
          .eq("verification_status", "approved")
          .eq("is_active", true)
          .maybeSingle(),

        supabase
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
              created_at
            `
          )
          .eq("scholar_id", scholarId)
          .eq("status", "approved")
          .neq("id", lectureId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (scholarResult.error) {
        throw scholarResult.error;
      }

      if (relatedResult.error) {
        throw relatedResult.error;
      }

      const scholarData =
        (scholarResult.data as ScholarRecord | null) ?? null;

      setScholar(scholarData);

      const relatedRows =
        (relatedResult.data ?? []) as RelatedLecture[];

      const lectureQueueKey =
        `scholar_lecture_queue_${lectureData.scholar_id}`;

      let savedQueueIds: string[] = [];

      try {
        const savedQueue =
          sessionStorage.getItem(lectureQueueKey);

        if (savedQueue) {
          const parsedQueue = JSON.parse(savedQueue);

          if (Array.isArray(parsedQueue)) {
            savedQueueIds = parsedQueue.filter(
              (value): value is string =>
                typeof value === "string"
            );
          }
        }
      } catch (queueError) {
        console.error(
          "Unable to restore lecture queue:",
          queueError
        );
      }

      const orderedRelatedLectures = [...relatedRows].sort(
        (firstLecture, secondLecture) => {
          const firstIndex = savedQueueIds.indexOf(
            firstLecture.id
          );

          const secondIndex = savedQueueIds.indexOf(
            secondLecture.id
          );

          if (firstIndex === -1 && secondIndex === -1) {
            return 0;
          }

          if (firstIndex === -1) {
            return 1;
          }

          if (secondIndex === -1) {
            return -1;
          }

          return firstIndex - secondIndex;
        }
      );

      setRelatedLectures(orderedRelatedLectures);

      if (scholarData?.user_id) {
        const { data: scholarUserProfile, error: scholarProfileError } =
          await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("user_id", scholarData.user_id)
            .maybeSingle();

        if (scholarProfileError) {
          console.error(
            "Unable to load scholar profile picture:",
            scholarProfileError
          );
          setScholarAvatarUrl(null);
        } else {
          setScholarAvatarUrl(scholarUserProfile?.avatar_url ?? null);
        }
      } else {
        setScholarAvatarUrl(null);
      }
    } catch (error: any) {
      console.error("Unable to load scholar lecture:", error);

      toast({
        title: t("scholars.lectureViewer.loadError"),
        description:
          error?.message ||
          t("scholars.lectureViewer.loadErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [lectureId, scholarId, t, toast, user?.id]);

  useEffect(() => {
    setViewRecorded(false);
    setViewCount(0);
    setLikeCount(0);
    setIsLiked(false);
    setIsSaved(false);
    setScholarAvatarUrl(null);
    setCommentsOpen(false);
    setNewComment("");
    setIsPortraitVideo(false);
    progressLoadedRef.current = false;
    lastProgressSaveRef.current = 0;

    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }
  }, [lectureId]);

  useEffect(() => {
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!commentsOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [commentsOpen]);

  useEffect(() => {
    if (!commentsOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommentsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [commentsOpen]);

  const scholarInitials = useMemo(() => {
    if (!scholar?.display_name) {
      return "S";
    }

    return scholar.display_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [scholar?.display_name]);

  const formatDate = (value: string) => {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  };

  const handleShare = async () => {
    if (!lecture) {
      return;
    }

    const shareUrl = window.location.href;
    const shareText = `${lecture.title}${
      scholar?.display_name ? ` by ${scholar.display_name}` : ""
    }`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: lecture.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);

      toast({
        title: t("scholars.lectureViewer.linkCopied"),
        description: t(
          "scholars.lectureViewer.linkCopiedDescription"
        ),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Unable to share lecture:", error);

      toast({
        title: t("scholars.lectureViewer.shareError"),
        description: t(
          "scholars.lectureViewer.shareErrorDescription"
        ),
        variant: "destructive",
      });
    }
  };

  const recordLectureView = useCallback(async () => {
    if (!lectureId || !user?.id || viewRecorded) {
      return;
    }

    const { data, error } = await supabase
      .from("scholar_lecture_views")
      .upsert(
        {
          lecture_id: lectureId,
          user_id: user.id,
        },
        {
          onConflict: "lecture_id,user_id",
          ignoreDuplicates: true,
        }
      )
      .select("id");

    if (error) {
      console.error("Unable to record lecture view:", error);
      return;
    }

    setViewRecorded(true);

    if (data && data.length > 0) {
      setViewCount((current) => current + 1);
    }
  }, [lectureId, user?.id, viewRecorded]);

  const loadComments = useCallback(async () => {
    if (!lectureId) {
      return;
    }

    setCommentsLoading(true);

    try {
      const { data: commentRows, error: commentsError } = await supabase
        .from("scholar_lecture_comments")
        .select("id, lecture_id, user_id, content, created_at")
        .eq("lecture_id", lectureId)
        .order("created_at", { ascending: true });

      if (commentsError) {
        throw commentsError;
      }

      const userIds = [
        ...new Set(
          (commentRows ?? []).map((comment) => comment.user_id)
        ),
      ];

      let profileRows: Array<{
        user_id: string;
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }> = [];

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } =
          await supabase
            .from("profiles")
            .select("user_id, full_name, username, avatar_url")
            .in("user_id", userIds);

        if (profilesError) {
          console.error(
            "Unable to load comment profiles:",
            profilesError
          );
        } else {
          profileRows = profilesData ?? [];
        }
      }

      const commentsWithProfiles = (commentRows ?? []).map(
        (comment) => ({
          ...comment,
          profiles:
            profileRows.find(
              (profile) => profile.user_id === comment.user_id
            ) ?? null,
        })
      );

      setComments(commentsWithProfiles as LectureComment[]);
      setCommentCount(commentsWithProfiles.length);
    } catch (error) {
      console.error("Unable to load lecture comments:", error);
    } finally {
      setCommentsLoading(false);
    }
  }, [lectureId]);

  useEffect(() => {
    void loadLecture();
  }, [loadLecture]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleLike = async () => {
    if (!lectureId) {
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (liking) {
      return;
    }

    setLiking(true);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("scholar_lecture_likes")
          .delete()
          .eq("lecture_id", lectureId)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        setIsLiked(false);
        setLikeCount((current) => Math.max(0, current - 1));
      } else {
        const { error } = await supabase
          .from("scholar_lecture_likes")
          .insert({
            lecture_id: lectureId,
            user_id: user.id,
          });

        if (error) {
          throw error;
        }

        setIsLiked(true);
        setLikeCount((current) => current + 1);
      }
    } catch (error: any) {
      console.error("Unable to update lecture like:", error);

      toast({
        title: t("scholars.lectureViewer.likeError"),
        description:
          error?.message || t("scholars.lectureViewer.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setLiking(false);
    }
  };

  const handleSave = async () => {
    if (!lectureId) {
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      if (isSaved) {
        const { error } = await supabase
          .from("scholar_lecture_saves")
          .delete()
          .eq("lecture_id", lectureId)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        setIsSaved(false);

        toast({
          title: t("scholars.lectureViewer.saveRemoved"),
        });
      } else {
        const { error } = await supabase
          .from("scholar_lecture_saves")
          .insert({
            lecture_id: lectureId,
            user_id: user.id,
          });

        if (error) {
          throw error;
        }

        setIsSaved(true);

        toast({
          title: t("scholars.lectureViewer.saveAdded"),
        });
      }
    } catch (error: any) {
      console.error("Unable to update saved lecture:", error);

      toast({
        title: t("scholars.lectureViewer.saveError"),
        description:
          error?.message || t("scholars.lectureViewer.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenComments = () => {
    setCommentsOpen(true);
  };

  const handleCommentSubmit = async () => {
    if (!lectureId) {
      return;
    }

    if (!user?.id) {
      setCommentsOpen(false);
      navigate("/auth");
      return;
    }

    const trimmedComment = newComment.trim();

    if (!trimmedComment || submittingComment) {
      return;
    }

    setSubmittingComment(true);

    try {
      const { error } = await supabase
        .from("scholar_lecture_comments")
        .insert({
          lecture_id: lectureId,
          user_id: user.id,
          content: trimmedComment,
        });

      if (error) {
        throw error;
      }

      setNewComment("");
      await loadComments();
      setCommentsOpen(false);
    } catch (error: any) {
      console.error("Unable to add lecture comment:", error);

      toast({
        title: t("scholars.lectureViewer.commentAddError"),
        description:
          error?.message || t("scholars.lectureViewer.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from("scholar_lecture_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Unable to delete lecture comment:", error);

      toast({
        title: t("scholars.lectureViewer.commentDeleteError"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await loadComments();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{t("scholars.lectureViewer.loading")}</span>
        </div>
      </main>
    );
  }

  if (notFound || !lecture) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />

            <h1 className="text-xl font-semibold">
              {t("scholars.lectureViewer.unavailable")}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "scholars.lectureViewer.unavailableDescription"
              )}
            </p>

            <Button
              type="button"
              className="mt-6"
              onClick={() =>
                navigate(
                  scholarId
                    ? `/scholars/${scholarId}`
                    : "/scholars"
                )
              }
            >
              {t("scholars.lectureViewer.returnToScholar")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen scroll-smooth bg-background pb-24">
      <div className="mx-auto w-full max-w-5xl px-0 sm:px-4">
        <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-0 sm:py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/scholars/${lecture.scholar_id}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("scholars.lectureViewer.back")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className={isSaved ? "text-primary" : ""}
          >
            <Bookmark
              className={`mr-2 h-4 w-4 ${
                isSaved ? "fill-current" : ""
              }`}
            />
            {isSaved
              ? t("scholars.lectureViewer.saved")
              : t("scholars.lectureViewer.save")}
          </Button>
        </header>

        {scholar && (
          <div className="sticky top-0 z-30 border-y bg-background/95 px-4 py-3 shadow-sm backdrop-blur sm:rounded-xl sm:border">
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => navigate(`/scholars/${scholar.id}`)}
            >
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage
                  src={scholarAvatarUrl ?? undefined}
                  alt={scholar.display_name}
                  className="object-cover"
                />
                <AvatarFallback>{scholarInitials}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">
                    {scholar.display_name}
                  </p>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                </div>

                {(scholar.city || scholar.country) && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[scholar.city, scholar.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>

              <span className="shrink-0 text-xs font-medium text-primary sm:text-sm">
                {t("scholars.lectureViewer.viewProfile")}
              </span>
            </button>
          </div>
        )}

        <section className="relative bg-black sm:mt-2 sm:overflow-hidden sm:rounded-xl">
          <video
            ref={videoRef}
            key={lecture.id}
            src={lecture.video_url}
            poster={lecture.thumbnail_url ?? undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;

              setIsPortraitVideo(
                video.videoHeight > video.videoWidth
              );

              void restoreLectureProgress(video);

              const shouldAutoplay =
                sessionStorage.getItem(
                  "scholar_lecture_autoplay"
                ) === "true";

              if (shouldAutoplay) {
                sessionStorage.removeItem(
                  "scholar_lecture_autoplay"
                );

                window.setTimeout(() => {
                  void video.play().catch((playError) => {
                    console.error(
                      "Unable to autoplay next lecture:",
                      playError
                    );
                  });
                }, 150);
              }
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;

              if (!user?.id || !Number.isFinite(video.duration)) {
                return;
              }

              if (
                video.currentTime - lastProgressSaveRef.current >=
                10
              ) {
                lastProgressSaveRef.current = video.currentTime;

                void saveLectureProgress(
                  video.currentTime,
                  video.duration,
                  false
                );
              }
            }}
            onPlay={() => {
              if (viewRecorded || viewTimerRef.current) {
                return;
              }

              viewTimerRef.current = setTimeout(() => {
                void recordLectureView();
                viewTimerRef.current = null;
              }, 3000);
            }}
            onPause={(event) => {
              if (viewTimerRef.current) {
                clearTimeout(viewTimerRef.current);
                viewTimerRef.current = null;
              }

              const video = event.currentTarget;

              if (
                video.currentTime > 0 &&
                video.currentTime < video.duration
              ) {
                void saveLectureProgress(
                  video.currentTime,
                  video.duration,
                  false
                );
              }
            }}
            onEnded={(event) => {
              if (viewTimerRef.current) {
                clearTimeout(viewTimerRef.current);
                viewTimerRef.current = null;
              }

              void saveLectureProgress(
                event.currentTarget.duration,
                event.currentTarget.duration,
                true
              );

              if (
                !lecture ||
                relatedLectures.length === 0
              ) {
                return;
              }

              const nextLecture = relatedLectures[0];

              const currentQueueIds = [
                lecture.id,
                ...relatedLectures.map(
                  (relatedLecture) =>
                    relatedLecture.id
                ),
              ];

              const rotatedQueueIds = [
                ...currentQueueIds.slice(1),
                currentQueueIds[0],
              ];

              const lectureQueueKey =
                `scholar_lecture_queue_${lecture.scholar_id}`;

              sessionStorage.setItem(
                lectureQueueKey,
                JSON.stringify(rotatedQueueIds)
              );

              sessionStorage.setItem(
                "scholar_lecture_autoplay",
                "true"
              );

              navigate(
                `/scholars/${nextLecture.scholar_id}/lectures/${nextLecture.id}`
              );

              window.setTimeout(() => {
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }, 50);
            }}
            className={
              isPortraitVideo
                ? "h-[68vh] min-h-[520px] max-h-[820px] w-full bg-black object-contain"
                : "aspect-video w-full bg-black object-contain"
            }
          >
            {t("scholars.lectureViewer.videoUnsupported")}
          </video>

          <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3 sm:right-4">
            <button
              type="button"
              onClick={() => void handleLike()}
              disabled={liking}
              className={`flex h-14 min-w-14 flex-col items-center justify-center rounded-full border border-white/10 bg-black/65 px-2 text-white shadow-xl backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-black/80 active:scale-95 ${
                isLiked ? "text-primary" : ""
              }`}
              aria-label={t("scholars.lectureViewer.like", {
                count: likeCount,
              })}
            >
              <Heart
                className={`h-6 w-6 ${
                  isLiked ? "fill-current" : ""
                }`}
              />
              <span className="mt-1 text-xs font-bold leading-none">
                {likeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenComments}
              className="flex h-14 min-w-14 flex-col items-center justify-center rounded-full border border-white/10 bg-black/65 px-2 text-white shadow-xl backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-black/80 active:scale-95"
              aria-label={t("scholars.lectureViewer.comment", {
                count: commentCount,
              })}
            >
              <MessageCircle className="h-6 w-6" />
              <span className="mt-1 text-xs font-bold leading-none">
                {commentCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-14 min-w-14 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white shadow-xl backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-black/80 active:scale-95"
              aria-label={t("scholars.lectureViewer.share")}
            >
              <Share2 className="h-6 w-6" />
            </button>
          </div>
        </section>

        <section className="space-y-2 px-4 pb-0 pt-3 sm:px-1">
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              {lecture.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
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

              <span className="text-xs text-muted-foreground sm:text-sm">
                {t("scholars.lectureViewer.view", {
                  count: viewCount,
                })}
              </span>

              <span className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(lecture.created_at)}
              </span>
            </div>
          </div>

          {lecture.description ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {lecture.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("scholars.lectureViewer.noDescription")}
            </p>
          )}

        </section>

        <section className="px-4 pt-1 sm:px-1">
          <div className="mb-4 border-t pt-4">
            <h2 className="text-lg font-bold">
              {t("scholars.lectureViewer.moreFromScholar")}
            </h2>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("scholars.lectureViewer.continueLearning")}
            </p>
          </div>

          {relatedLectures.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <BookOpen className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />

              <p className="text-sm text-muted-foreground">
                {t("scholars.lectureViewer.noOtherLectures")}
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {relatedLectures.map((relatedLecture) => (
                <article
                  key={relatedLecture.id}
                  className="overflow-hidden border-b border-border/80 pb-7 pt-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="overflow-hidden rounded-xl border bg-black shadow-sm">
                    <video
                      src={relatedLecture.video_url}
                      poster={relatedLecture.thumbnail_url ?? undefined}
                      controls
                      playsInline
                      preload="metadata"
                      onPlay={(event) => {
                        document
                          .querySelectorAll<HTMLVideoElement>("video")
                          .forEach((video) => {
                            if (video !== event.currentTarget) {
                              video.pause();
                            }
                          });
                      }}
                      className="aspect-video w-full bg-black object-contain"
                    >
                      {t("scholars.lectureViewer.videoUnsupported")}
                    </video>
                  </div>

                  <button
                    type="button"
                    className="block w-full px-1 pt-3 text-left"
                    onClick={() => {
                      navigate(
                        `/scholars/${relatedLecture.scholar_id}/lectures/${relatedLecture.id}`
                      );

                      window.setTimeout(() => {
                        window.scrollTo({
                          top: 0,
                          behavior: "smooth",
                        });
                      }, 50);
                    }}
                  >
                    <h3 className="text-lg font-bold leading-snug">
                      {relatedLecture.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      {relatedLecture.category && (
                        <Badge variant="secondary">
                          {relatedLecture.category}
                        </Badge>
                      )}

                      {relatedLecture.language && (
                        <Badge variant="outline">
                          {relatedLecture.language}
                        </Badge>
                      )}

                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(relatedLecture.created_at)}
                      </span>
                    </div>

                    {relatedLecture.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {relatedLecture.description}
                      </p>
                    )}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

       {commentsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4"
          onPointerDown={() => setCommentsOpen(false)}
          role="presentation"
        >
          <section
            className="max-h-[78vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl"
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("scholars.lectureViewer.comments")}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="h-5 w-5" />
                  {t("scholars.lectureViewer.comments")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("scholars.lectureViewer.commentCount", {
                    count: commentCount,
                  })}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCommentsOpen(false)}
                aria-label="Close comments"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t(
                    "scholars.lectureViewer.loadingComments"
                  )}
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("scholars.lectureViewer.noComments")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const commenterName =
                      comment.profiles?.full_name ||
                      comment.profiles?.username ||
                      t(
                        "scholars.lectureViewer.memberFallback"
                      );

                    const commenterInitials = commenterName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("");

                    return (
                      <div
                        key={comment.id}
                        className="flex items-start gap-3"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={
                              comment.profiles?.avatar_url ??
                              undefined
                            }
                            alt={commenterName}
                          />
                          <AvatarFallback>
                            {commenterInitials || "T"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">
                                {commenterName}
                              </p>

                              {comment.profiles?.username && (
                                <p className="text-xs text-muted-foreground">
                                  @{comment.profiles.username}
                                </p>
                              )}
                            </div>

                            {comment.user_id === user?.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-destructive"
                                onClick={() =>
                                  void handleDeleteComment(
                                    comment.id
                                  )
                                }
                                aria-label={t(
                                  "scholars.lectureViewer.deleteComment"
                                )}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                            {comment.content}
                          </p>

                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(comment.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t bg-background p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(event) =>
                    setNewComment(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      void handleCommentSubmit();
                    }
                  }}
                  placeholder={
                    user?.id
                      ? t(
                          "scholars.lectureViewer.writeComment"
                        )
                      : t(
                          "scholars.lectureViewer.signInToComment"
                        )
                  }
                  disabled={!user?.id || submittingComment}
                  maxLength={1000}
                  rows={2}
                  className="max-h-28 min-h-[48px] flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-xl"
                  onClick={() => void handleCommentSubmit()}
                  disabled={
                    !user?.id ||
                    !newComment.trim() ||
                    submittingComment
                  }
                  aria-label={t(
                    "scholars.lectureViewer.postComment"
                  )}
                >
                  {submittingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ScholarLectureViewer;
