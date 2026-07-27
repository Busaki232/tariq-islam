import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type LectureFeedItem = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  created_at: string;
  captions_enabled: boolean;
  captions_language: string | null;
  captions_segments: unknown[] | null;
  scholar_name: string;
  scholar_city: string | null;
  scholar_country: string | null;
};

type ScholarRow = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
};

type CaptionSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

type CaptionTranslation = {
  language_code: string;
  language_name: string;
  translated_segments: CaptionSegment[] | null;
};

type CaptionPosition = {
  x: number;
  y: number;
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

const normalizeCaptionSegments = (
  value: unknown
): CaptionSegment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((segment, index) => {
      const item = segment as Partial<CaptionSegment>;

      return {
        id: typeof item.id === "number" ? item.id : index,
        start: Number(item.start),
        end: Number(item.end),
        text:
          typeof item.text === "string"
            ? item.text.trim()
            : "",
      };
    })
    .filter(
      (segment) =>
        Boolean(segment.text) &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
    );
};

const ScholarLecturesFeed = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const { toast } = useToast();

  const [lectures, setLectures] = useState<LectureFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLectureId, setActiveLectureId] =
    useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const [captionTimes, setCaptionTimes] =
    useState<Record<string, number>>({});
  const [
    selectedCaptionLanguages,
    setSelectedCaptionLanguages,
  ] = useState<Record<string, string>>({});
  const [collapsedCaptions, setCollapsedCaptions] =
    useState<Record<string, boolean>>({});
  const [captionPositions, setCaptionPositions] =
    useState<Record<string, CaptionPosition>>({});
  const [
    translationsByLectureId,
    setTranslationsByLectureId,
  ] = useState<Record<string, CaptionTranslation[]>>({});

  const [likeCounts, setLikeCounts] =
    useState<Record<string, number>>({});
  const [likedLectureIds, setLikedLectureIds] =
    useState<string[]>([]);
  const [likingLectureIds, setLikingLectureIds] =
    useState<string[]>([]);
  const [commentCounts, setCommentCounts] =
    useState<Record<string, number>>({});

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedCommentLecture, setSelectedCommentLecture] =
    useState<LectureFeedItem | null>(null);
  const [comments, setComments] = useState<LectureComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] =
    useState(false);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs =
    useRef<Map<string, HTMLVideoElement>>(new Map());
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const captionDragRef = useRef<{
    lectureId: string;
    startPointerX: number;
    startPointerY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);

  useEffect(() => {
    const loadFeed = async () => {
      setLoading(true);

      try {
        const { data: lectureRows, error: lectureError } =
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
                created_at,
                captions_enabled,
                captions_language,
                captions_segments
              `
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(50);

        if (lectureError) {
          throw lectureError;
        }

        const lectureIds = (lectureRows ?? []).map(
          (lecture) => lecture.id
        );
        const scholarIds = Array.from(
          new Set(
            (lectureRows ?? []).map(
              (lecture) => lecture.scholar_id
            )
          )
        );

        const [
          translationsResult,
          scholarsResult,
          likesResult,
          commentsResult,
        ] = await Promise.all([
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_caption_translations")
                .select(
                  "lecture_id,language_code,language_name,translated_segments"
                )
                .in("lecture_id", lectureIds)
                .order("language_name", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          scholarIds.length > 0
            ? supabase
                .from("scholar_profiles")
                .select("id,display_name,city,country")
                .in("id", scholarIds)
                .eq("verification_status", "approved")
                .eq("is_active", true)
            : Promise.resolve({ data: [], error: null }),
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_likes")
                .select("lecture_id,user_id")
                .in("lecture_id", lectureIds)
            : Promise.resolve({ data: [], error: null }),
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_comments")
                .select("lecture_id")
                .in("lecture_id", lectureIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (translationsResult.error) {
          console.error(
            "Unable to load feed caption translations:",
            translationsResult.error
          );
        }

        if (scholarsResult.error) {
          throw scholarsResult.error;
        }

        if (likesResult.error) {
          console.error(
            "Unable to load lecture likes:",
            likesResult.error
          );
        }

        if (commentsResult.error) {
          console.error(
            "Unable to load lecture comment counts:",
            commentsResult.error
          );
        }

        const translationsMap: Record<
          string,
          CaptionTranslation[]
        > = {};

        (translationsResult.data ?? []).forEach((row) => {
          const lectureTranslations =
            translationsMap[row.lecture_id] ?? [];

          lectureTranslations.push({
            language_code: row.language_code,
            language_name: row.language_name,
            translated_segments: Array.isArray(
              row.translated_segments
            )
              ? normalizeCaptionSegments(
                  row.translated_segments
                )
              : null,
          });

          translationsMap[row.lecture_id] =
            lectureTranslations;
        });

        setTranslationsByLectureId(translationsMap);

        const scholarsById = new Map(
          ((scholarsResult.data ?? []) as ScholarRow[]).map(
            (scholar) => [scholar.id, scholar]
          )
        );

        const items = (lectureRows ?? [])
          .map((lecture) => {
            const scholar = scholarsById.get(
              lecture.scholar_id
            );

            if (!scholar) {
              return null;
            }

            return {
              ...lecture,
              scholar_name: scholar.display_name,
              scholar_city: scholar.city,
              scholar_country: scholar.country,
            } as LectureFeedItem;
          })
          .filter(
            (lecture): lecture is LectureFeedItem =>
              lecture !== null
          );

        const nextLikeCounts: Record<string, number> = {};
        const nextCommentCounts: Record<string, number> = {};

        lectureIds.forEach((lectureId) => {
          nextLikeCounts[lectureId] = 0;
          nextCommentCounts[lectureId] = 0;
        });

        (likesResult.data ?? []).forEach((row) => {
          nextLikeCounts[row.lecture_id] =
            (nextLikeCounts[row.lecture_id] ?? 0) + 1;
        });

        (commentsResult.data ?? []).forEach((row) => {
          nextCommentCounts[row.lecture_id] =
            (nextCommentCounts[row.lecture_id] ?? 0) + 1;
        });

        setLectures(items);
        setLikeCounts(nextLikeCounts);
        setCommentCounts(nextCommentCounts);
        setLikedLectureIds(
          user?.id
            ? (likesResult.data ?? [])
                .filter((row) => row.user_id === user.id)
                .map((row) => row.lecture_id)
            : []
        );
      } catch (error) {
        console.error(
          "Unable to load scholar lecture feed:",
          error
        );
        setLectures([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFeed();
  }, [user?.id]);

  useEffect(() => {
    if (
      loading ||
      lectures.length === 0 ||
      commentsOpen
    ) {
      if (commentsOpen) {
        videoRefs.current.forEach((video) => video.pause());
      }

      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              second.intersectionRatio -
              first.intersectionRatio
          )[0];

        if (
          !mostVisible ||
          mostVisible.intersectionRatio < 0.65
        ) {
          return;
        }

        const lectureId = (
          mostVisible.target as HTMLElement
        ).dataset.lectureId;

        if (!lectureId) {
          return;
        }

        setActiveLectureId(lectureId);

        videoRefs.current.forEach((video, id) => {
          if (id === lectureId) {
            video.muted = !soundEnabled;
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      {
        root: feedRef.current,
        threshold: [0.25, 0.5, 0.65, 0.8, 1],
      }
    );

    const cards = feedRef.current?.querySelectorAll<HTMLElement>(
      "[data-lecture-id]"
    );

    cards?.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      videoRefs.current.forEach((video) => video.pause());
    };
  }, [
    lectures,
    loading,
    soundEnabled,
    commentsOpen,
  ]);

  useEffect(() => {
    if (!commentsOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [commentsOpen]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));

  const handleCaptionPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    lectureId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const position = captionPositions[lectureId] ?? {
      x: 0,
      y: 0,
    };

    captionDragRef.current = {
      lectureId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startPositionX: position.x,
      startPositionY: position.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCaptionPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const drag = captionDragRef.current;

    if (!drag) {
      return;
    }

    setCaptionPositions((current) => ({
      ...current,
      [drag.lectureId]: {
        x:
          drag.startPositionX +
          event.clientX -
          drag.startPointerX,
        y:
          drag.startPositionY +
          event.clientY -
          drag.startPointerY,
      },
    }));
  };

  const handleCaptionPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    captionDragRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  };

  const handleLike = async (lectureId: string) => {
    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (likingLectureIds.includes(lectureId)) {
      return;
    }

    const isLiked = likedLectureIds.includes(lectureId);
    setLikingLectureIds((current) => [
      ...current,
      lectureId,
    ]);

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

        setLikedLectureIds((current) =>
          current.filter((id) => id !== lectureId)
        );
        setLikeCounts((current) => ({
          ...current,
          [lectureId]: Math.max(
            0,
            (current[lectureId] ?? 0) - 1
          ),
        }));
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

        setLikedLectureIds((current) => [
          ...current,
          lectureId,
        ]);
        setLikeCounts((current) => ({
          ...current,
          [lectureId]: (current[lectureId] ?? 0) + 1,
        }));
      }
    } catch (error) {
      console.error("Unable to update lecture like:", error);
      toast({
        title: t("scholars.lectureViewer.likeError", {
          defaultValue: "Unable to update like",
        }),
        variant: "destructive",
      });
    } finally {
      setLikingLectureIds((current) =>
        current.filter((id) => id !== lectureId)
      );
    }
  };

  const loadComments = async (lectureId: string) => {
    setCommentsLoading(true);

    try {
      const { data: commentRows, error: commentsError } =
        await supabase
          .from("scholar_lecture_comments")
          .select(
            "id,lecture_id,user_id,content,created_at"
          )
          .eq("lecture_id", lectureId)
          .order("created_at", { ascending: true });

      if (commentsError) {
        throw commentsError;
      }

      const userIds = Array.from(
        new Set(
          (commentRows ?? []).map(
            (comment) => comment.user_id
          )
        )
      );

      let profileRows: Array<{
        user_id: string;
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }> = [];

      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "user_id,full_name,username,avatar_url"
          )
          .in("user_id", userIds);

        if (error) {
          console.error(
            "Unable to load comment profiles:",
            error
          );
        } else {
          profileRows = data ?? [];
        }
      }

      const nextComments = (commentRows ?? []).map(
        (comment) => ({
          ...comment,
          profiles:
            profileRows.find(
              (profile) =>
                profile.user_id === comment.user_id
            ) ?? null,
        })
      ) as LectureComment[];

      setComments(nextComments);
      setCommentCounts((current) => ({
        ...current,
        [lectureId]: nextComments.length,
      }));
    } catch (error) {
      console.error(
        "Unable to load lecture comments:",
        error
      );
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenComments = (
    lecture: LectureFeedItem
  ) => {
    setSelectedCommentLecture(lecture);
    setCommentsOpen(true);
    setComments([]);
    void loadComments(lecture.id);
  };

  const handleCommentSubmit = async () => {
    if (!selectedCommentLecture) {
      return;
    }

    if (!user?.id) {
      setCommentsOpen(false);
      navigate("/auth");
      return;
    }

    const content = newComment.trim();

    if (!content || submittingComment) {
      return;
    }

    setSubmittingComment(true);

    try {
      const { error } = await supabase
        .from("scholar_lecture_comments")
        .insert({
          lecture_id: selectedCommentLecture.id,
          user_id: user.id,
          content,
        });

      if (error) {
        throw error;
      }

      setNewComment("");
      await loadComments(selectedCommentLecture.id);
      setCommentsOpen(false);
      setSelectedCommentLecture(null);
    } catch (error) {
      console.error(
        "Unable to add lecture comment:",
        error
      );
      toast({
        title: t(
          "scholars.lectureViewer.commentAddError",
          { defaultValue: "Unable to add comment" }
        ),
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (
    commentId: string
  ) => {
    if (!user?.id || !selectedCommentLecture) {
      return;
    }

    const { error } = await supabase
      .from("scholar_lecture_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) {
      console.error(
        "Unable to delete lecture comment:",
        error
      );
      return;
    }

    await loadComments(selectedCommentLecture.id);
  };

  const handleShare = async (
    lecture: LectureFeedItem
  ) => {
    const shareUrl =
      `${window.location.origin}/scholars/` +
      `${lecture.scholar_id}/lectures/${lecture.id}`;
    const shareText =
      `${lecture.title} by ${lecture.scholar_name}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: lecture.title,
          text: shareText,
          url: shareUrl,
          dialogTitle: t(
            "scholars.lectureViewer.shareLecture",
            { defaultValue: "Share Lecture" }
          ),
        });
        return;
      }

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
        title: t(
          "scholars.lectureViewer.linkCopied",
          { defaultValue: "Link copied" }
        ),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.toLowerCase()
          : "";

      if (
        (error instanceof DOMException &&
          error.name === "AbortError") ||
        message.includes("cancel")
      ) {
        return;
      }

      console.error("Unable to share lecture:", error);
      toast({
        title: t(
          "scholars.lectureViewer.shareError",
          { defaultValue: "Unable to share" }
        ),
        variant: "destructive",
      });
    }
  };

  const playNextLecture = (lectureId: string) => {
    const currentIndex = lectures.findIndex(
      (lecture) => lecture.id === lectureId
    );
    const nextLecture =
      lectures[currentIndex + 1] ?? lectures[0];

    document
      .getElementById(`lecture-feed-${nextLecture.id}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label={t("common.back", {
            defaultValue: "Back",
          })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div>
          <h1 className="font-bold">
            {t("scholars.lectureFeed.title", {
              defaultValue: "Scholar Lectures",
            })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("scholars.lectureFeed.subtitle", {
              defaultValue: "Learn from verified scholars",
            })}
          </p>
        </div>
      </header>

      {lectures.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {t("scholars.lectureFeed.empty", {
              defaultValue: "No lectures available yet",
            })}
          </p>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="h-[calc(100dvh-7rem)] snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        >
          {lectures.map((lecture) => {
            const isActive =
              activeLectureId === lecture.id;
            const lectureTranslations =
              translationsByLectureId[lecture.id] ?? [];
            const originalCaptionSegments =
              normalizeCaptionSegments(
                lecture.captions_segments
              );
            const selectedCaptionLanguage =
              selectedCaptionLanguages[lecture.id] ??
              (originalCaptionSegments.length > 0
                ? "original"
                : lectureTranslations[0]?.language_code ??
                  "off");
            const selectedTranslation =
              lectureTranslations.find(
                (translation) =>
                  translation.language_code ===
                  selectedCaptionLanguage
              );
            const activeSegments =
              selectedCaptionLanguage === "off"
                ? []
                : selectedCaptionLanguage === "original"
                  ? originalCaptionSegments
                  : selectedTranslation?.translated_segments ??
                    [];
            const currentCaptionTime =
              captionTimes[lecture.id] ?? 0;
            const activeCaption =
              activeSegments.find(
                (segment) =>
                  currentCaptionTime >= segment.start &&
                  currentCaptionTime < segment.end
              )?.text ?? "";
            const hasCaptionChoices =
              originalCaptionSegments.length > 0 ||
              lectureTranslations.some(
                (translation) =>
                  Array.isArray(
                    translation.translated_segments
                  ) &&
                  translation.translated_segments.length > 0
              );
            const captionsCollapsed =
              collapsedCaptions[lecture.id] ?? false;
            const captionPosition =
              captionPositions[lecture.id] ?? {
                x: 0,
                y: 0,
              };
            const isLiked =
              likedLectureIds.includes(lecture.id);
            const isLiking =
              likingLectureIds.includes(lecture.id);
            const location = [
              lecture.scholar_city,
              lecture.scholar_country,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <article
                id={`lecture-feed-${lecture.id}`}
                key={lecture.id}
                data-lecture-id={lecture.id}
                className="flex min-h-[calc(100dvh-7rem)] snap-start flex-col bg-background pb-6"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() =>
                    navigate(
                      `/scholars/${lecture.scholar_id}`
                    )
                  }
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {lecture.scholar_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) =>
                        part[0]?.toUpperCase()
                      )
                      .join("") || "S"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-semibold">
                      {lecture.scholar_name}
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {location ||
                        formatDate(lecture.created_at)}
                    </p>
                  </div>
                </button>

                <div className="relative h-[68dvh] min-h-[520px] overflow-hidden bg-black sm:mx-auto sm:w-full sm:max-w-2xl sm:rounded-2xl">
                  <video
                    ref={(node) => {
                      if (node) {
                        videoRefs.current.set(
                          lecture.id,
                          node
                        );
                      } else {
                        videoRefs.current.delete(lecture.id);
                      }
                    }}
                    src={lecture.video_url}
                    poster={
                      lecture.thumbnail_url ?? undefined
                    }
                    muted={!soundEnabled}
                    playsInline
                    preload="metadata"
                    className="h-full w-full select-none bg-black object-contain"
          onTimeUpdate={(event) => {
            const currentTime =
              event.currentTarget?.currentTime ?? 0;

            setCaptionTimes((current) => ({
              ...current,
              [lecture.id]: currentTime,
            }));
          }}
                    onEnded={() =>
                      playNextLecture(lecture.id)
                    }
                    onClick={(event) => {
                      const video = event.currentTarget;

                      if (video.paused) {
                        void video.play();
                      } else {
                        video.pause();
                      }
                    }}
                  />

                  {!lecture.thumbnail_url && !isActive && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/30 via-slate-900 to-black px-8 text-center text-white">
                      <BookOpen className="mb-3 h-10 w-10" />
                      <p className="line-clamp-2 text-lg font-bold">
                        {lecture.title}
                      </p>
                      <p className="mt-1 text-sm text-white/75">
                        {lecture.scholar_name}
                      </p>
                    </div>
                  )}

                  {isActive && hasCaptionChoices && (
                    <div
                      className="absolute left-1/2 top-[38%] z-20 w-[calc(100%-5rem)] max-w-lg -translate-x-1/2"
                      style={{
                        transform:
                          `translate(calc(-50% + ${captionPosition.x}px), ` +
                          `${captionPosition.y}px)`,
                      }}
                    >
                      <div className="overflow-hidden rounded-xl border border-white/15 bg-black/80 text-white shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
                          <button
                            type="button"
                            onPointerDown={(event) =>
                              handleCaptionPointerDown(
                                event,
                                lecture.id
                              )
                            }
                            onPointerMove={
                              handleCaptionPointerMove
                            }
                            onPointerUp={
                              handleCaptionPointerUp
                            }
                            onPointerCancel={
                              handleCaptionPointerUp
                            }
                            className="touch-none cursor-grab rounded-md p-1 text-white/75 active:cursor-grabbing"
                            aria-label={t(
                              "scholars.lectureFeed.moveCaptions",
                              {
                                defaultValue:
                                  "Move captions",
                              }
                            )}
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>

                          <select
                            value={
                              selectedCaptionLanguage
                            }
                            onChange={(event) =>
                              setSelectedCaptionLanguages(
                                (current) => ({
                                  ...current,
                                  [lecture.id]:
                                    event.target.value,
                                })
                              )
                            }
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-sm font-semibold text-white outline-none"
                            aria-label={t(
                              "scholars.lectureFeed.captionLanguage",
                              {
                                defaultValue:
                                  "Caption language",
                              }
                            )}
                          >
                            <option value="off">
                              {t(
                                "scholars.lectureFeed.captionsOff",
                                {
                                  defaultValue:
                                    "Captions Off",
                                }
                              )}
                            </option>

                            {originalCaptionSegments.length >
                              0 && (
                              <option value="original">
                                {t(
                                  "scholars.lectureFeed.original",
                                  {
                                    defaultValue:
                                      "Original",
                                  }
                                )}
                              </option>
                            )}

                            {lectureTranslations.map(
                              (translation) => (
                                <option
                                  key={
                                    translation.language_code
                                  }
                                  value={
                                    translation.language_code
                                  }
                                >
                                  {
                                    translation.language_name
                                  }
                                </option>
                              )
                            )}
                          </select>

                          <button
                            type="button"
                            className="rounded-lg bg-white/10 p-1.5"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCollapsedCaptions(
                                (current) => ({
                                  ...current,
                                  [lecture.id]:
                                    !captionsCollapsed,
                                })
                              );
                            }}
                            aria-label={
                              captionsCollapsed
                                ? t(
                                    "scholars.lectureFeed.expandCaptions",
                                    {
                                      defaultValue:
                                        "Expand captions",
                                    }
                                  )
                                : t(
                                    "scholars.lectureFeed.collapseCaptions",
                                    {
                                      defaultValue:
                                        "Collapse captions",
                                    }
                                  )
                            }
                          >
                            {captionsCollapsed ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                        </div>

                        {!captionsCollapsed &&
                          selectedCaptionLanguage !==
                            "off" && (
                            <div
                              dir={
                                selectedCaptionLanguage ===
                                  "ar" ||
                                selectedCaptionLanguage ===
                                  "ur"
                                  ? "rtl"
                                  : "auto"
                              }
                              className="max-h-24 overflow-y-auto px-3 py-2 text-center text-sm font-medium leading-relaxed"
                            >
                              {activeCaption || (
                                <span className="text-white/55">
                                  {t(
                                    "scholars.lectureFeed.captionsWillAppear",
                                    {
                                      defaultValue:
                                        "Captions will appear here",
                                    }
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-4">
                    <button
                      type="button"
                      disabled={isLiking}
                      onClick={() =>
                        void handleLike(lecture.id)
                      }
                      className="flex h-14 min-w-14 flex-col items-center justify-center rounded-full bg-black/65 px-2 text-white shadow-xl backdrop-blur-md"
                      aria-label={t(
                        "scholars.lectureViewer.like",
                        { defaultValue: "Like" }
                      )}
                    >
                      <Heart
                        className={`h-6 w-6 ${
                          isLiked
                            ? "fill-red-500 text-red-500"
                            : ""
                        }`}
                      />
                      <span className="text-xs font-bold">
                        {likeCounts[lecture.id] ?? 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenComments(lecture)
                      }
                      className="flex h-14 min-w-14 flex-col items-center justify-center rounded-full bg-black/65 px-2 text-white shadow-xl backdrop-blur-md"
                      aria-label={t(
                        "scholars.lectureViewer.comments",
                        { defaultValue: "Comments" }
                      )}
                    >
                      <MessageCircle className="h-6 w-6" />
                      <span className="text-xs font-bold">
                        {commentCounts[lecture.id] ?? 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleShare(lecture)
                      }
                      className="flex h-14 min-w-14 items-center justify-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-md"
                      aria-label={t(
                        "scholars.lectureViewer.share",
                        { defaultValue: "Share" }
                      )}
                    >
                      <Share2 className="h-6 w-6" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextSound = !soundEnabled;
                        setSoundEnabled(nextSound);

                        const activeVideo =
                          videoRefs.current.get(
                            lecture.id
                          );

                        if (activeVideo) {
                          activeVideo.muted = !nextSound;
                        }
                      }}
                      className="flex h-14 min-w-14 items-center justify-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-md"
                      aria-label={
                        soundEnabled
                          ? t(
                              "scholars.lectureFeed.muteVideo",
                              {
                                defaultValue:
                                  "Mute video",
                              }
                            )
                          : t(
                              "scholars.lectureFeed.turnOnSound",
                              {
                                defaultValue:
                                  "Turn on sound",
                              }
                            )
                      }
                    >
                      {soundEnabled ? (
                        <Volume2 className="h-6 w-6" />
                      ) : (
                        <VolumeX className="h-6 w-6" />
                      )}
                    </button>
                  </div>

                  <div className="pointer-events-none absolute bottom-4 left-4 right-20 z-10 text-white">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {lecture.category && (
                        <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground">
                          {lecture.category}
                        </span>
                      )}
                      {lecture.language && (
                        <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-xs font-semibold">
                          {lecture.language}
                        </span>
                      )}
                    </div>

                    <h2 className="line-clamp-2 text-xl font-bold drop-shadow-lg">
                      {lecture.title}
                    </h2>

                    {lecture.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow">
                        {lecture.description}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {commentsOpen && selectedCommentLecture && (
        <div
          className="fixed inset-0 z-[9999] flex items-end bg-black/60 sm:items-center sm:justify-center sm:p-4"
          onPointerDown={() => {
            setCommentsOpen(false);
            setSelectedCommentLecture(null);
          }}
          role="presentation"
        >
          <section
            className="max-h-[70dvh] w-full overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:max-w-2xl sm:rounded-2xl"
            onPointerDown={(event) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-label={t(
              "scholars.lectureViewer.comments",
              { defaultValue: "Comments" }
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="h-5 w-5" />
                  {t(
                    "scholars.lectureViewer.comments",
                    { defaultValue: "Comments" }
                  )}
                </h2>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {selectedCommentLecture.title}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCommentsOpen(false);
                  setSelectedCommentLecture(null);
                }}
                aria-label={t("common.close", {
                  defaultValue: "Close",
                })}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="max-h-[42dvh] overflow-y-auto px-4 py-3">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t(
                    "scholars.lectureViewer.loadingComments",
                    { defaultValue: "Loading comments" }
                  )}
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8" />
                  {t(
                    "scholars.lectureViewer.noComments",
                    { defaultValue: "No comments yet" }
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const commenterName =
                      comment.profiles?.full_name ||
                      comment.profiles?.username ||
                      t(
                        "scholars.lectureViewer.memberFallback",
                        { defaultValue: "Member" }
                      );
                    const initials = commenterName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) =>
                        part[0]?.toUpperCase()
                      )
                      .join("");

                    return (
                      <div
                        key={comment.id}
                        className="flex items-start gap-3"
                      >
                        {comment.profiles?.avatar_url ? (
                          <img
                            src={
                              comment.profiles.avatar_url
                            }
                            alt={commenterName}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {initials || "T"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {commenterName}
                            </p>

                            {comment.user_id ===
                              user?.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() =>
                                  void handleDeleteComment(
                                    comment.id
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                            {comment.content}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(
                              comment.created_at
                            )}
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
                          "scholars.lectureViewer.writeComment",
                          {
                            defaultValue:
                              "Write a comment",
                          }
                        )
                      : t(
                          "scholars.lectureViewer.signInToComment",
                          {
                            defaultValue:
                              "Sign in to comment",
                          }
                        )
                  }
                  disabled={
                    !user?.id || submittingComment
                  }
                  maxLength={1000}
                  rows={2}
                  className="max-h-28 min-h-12 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-xl"
                  onClick={() =>
                    void handleCommentSubmit()
                  }
                  disabled={
                    !user?.id ||
                    !newComment.trim() ||
                    submittingComment
                  }
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

export default ScholarLecturesFeed;
