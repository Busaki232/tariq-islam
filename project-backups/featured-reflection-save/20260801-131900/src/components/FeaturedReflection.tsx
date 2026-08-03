import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Heart,
  Loader2,
  MessageCircle,
  PlayCircle,
  Send,
  Share2,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

type VideoSource = "reflection" | "scholar";

type UnifiedVideo = {
  key: string;
  source: VideoSource;
  id: string;
  ownerId: string | null;
  scholarId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  language: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  createdAt: string;
  captionsEnabled: boolean;
  captionsSegments: unknown[] | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  ownerVerified: boolean;
};

type UnifiedComment = {
  id: string;
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

export default function FeaturedReflection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [videos, setVideos] = useState<UnifiedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoKey, setActiveVideoKey] =
    useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [videoTimes, setVideoTimes] =
    useState<Record<string, number>>({});

  const [translationsByVideoKey, setTranslationsByVideoKey] =
    useState<Record<string, CaptionTranslation[]>>({});
  const [
    selectedCaptionLanguages,
    setSelectedCaptionLanguages,
  ] = useState<Record<string, string>>({});
  const [collapsedCaptions, setCollapsedCaptions] =
    useState<Record<string, boolean>>({});
  const [captionPositions, setCaptionPositions] =
    useState<Record<string, CaptionPosition>>({});

  const [likeCounts, setLikeCounts] =
    useState<Record<string, number>>({});
  const [likedVideoKeys, setLikedVideoKeys] =
    useState<string[]>([]);
  const [likingVideoKeys, setLikingVideoKeys] =
    useState<string[]>([]);
  const [savedVideoKeys, setSavedVideoKeys] =
    useState<string[]>([]);
  const [savingVideoKeys, setSavingVideoKeys] =
    useState<string[]>([]);
  const [commentCounts, setCommentCounts] =
    useState<Record<string, number>>({});

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedCommentVideo, setSelectedCommentVideo] =
    useState<UnifiedVideo | null>(null);
  const [comments, setComments] = useState<UnifiedComment[]>(
    []
  );
  const [commentsLoading, setCommentsLoading] =
    useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] =
    useState(false);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs =
    useRef<Map<string, HTMLVideoElement>>(new Map());
  const commentInputRef = useRef<HTMLTextAreaElement | null>(
    null
  );
  const captionDragRef = useRef<{
    videoKey: string;
    startPointerX: number;
    startPointerY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      setLoading(true);

      try {
        const [
          reflectionResult,
          lectureResult,
        ] = await Promise.all([
          supabase
            .from("reflection_videos")
            .select(
              `
                id,
                user_id,
                title,
                caption,
                category,
                language,
                video_url,
                thumbnail_url,
                trim_start_seconds,
                trim_end_seconds,
                created_at,
                captions_enabled,
                captions_segments
              `
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("scholar_lectures")
            .select(
              `
                id,
                scholar_id,
                title,
                description,
                category,
                language,
                video_url,
                thumbnail_url,
                created_at,
                captions_enabled,
                captions_segments
              `
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (reflectionResult.error) {
          throw reflectionResult.error;
        }

        if (lectureResult.error) {
          throw lectureResult.error;
        }

        const reflectionRows =
          reflectionResult.data ?? [];
        const lectureRows = lectureResult.data ?? [];
        const reflectionIds = reflectionRows.map(
          (video) => video.id
        );
        const lectureIds = lectureRows.map(
          (lecture) => lecture.id
        );
        const scholarIds = Array.from(
          new Set(
            lectureRows.map(
              (lecture) => lecture.scholar_id
            )
          )
        );

        const scholarProfilesResult =
          scholarIds.length > 0
            ? await supabase
                .from("scholar_profiles")
                .select(
                  "id,user_id,display_name,verification_status"
                )
                .in("id", scholarIds)
                .eq("verification_status", "approved")
                .eq("is_active", true)
            : { data: [], error: null };

        if (scholarProfilesResult.error) {
          throw scholarProfilesResult.error;
        }

        const scholarProfiles =
          scholarProfilesResult.data ?? [];
        const profileUserIds = Array.from(
          new Set([
            ...reflectionRows
              .map((video) => video.user_id)
              .filter(
                (userId): userId is string =>
                  Boolean(userId)
              ),
            ...scholarProfiles
              .map((scholar) => scholar.user_id)
              .filter(
                (userId): userId is string =>
                  Boolean(userId)
              ),
          ])
        );

        const [
          profilesResult,
          reflectionTranslationsResult,
          scholarTranslationsResult,
          reflectionLikesResult,
          scholarLikesResult,
          reflectionCommentsResult,
          scholarCommentsResult,
        ] = await Promise.all([
          profileUserIds.length > 0
            ? supabase
                .from("profiles")
                .select(
                  "user_id,full_name,username,avatar_url,is_creator_verified"
                )
                .in("user_id", profileUserIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          reflectionIds.length > 0
            ? supabase
                .from(
                  "reflection_caption_translations"
                )
                .select(
                  "reflection_id,language_code,language_name,translated_segments"
                )
                .in("reflection_id", reflectionIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          lectureIds.length > 0
            ? supabase
                .from(
                  "scholar_lecture_caption_translations"
                )
                .select(
                  "lecture_id,language_code,language_name,translated_segments"
                )
                .in("lecture_id", lectureIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          reflectionIds.length > 0
            ? supabase
                .from("reflection_likes")
                .select("reflection_id,user_id")
                .in("reflection_id", reflectionIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_likes")
                .select("lecture_id,user_id")
                .in("lecture_id", lectureIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          reflectionIds.length > 0
            ? supabase
                .from("reflection_comments")
                .select("reflection_id")
                .in("reflection_id", reflectionIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_comments")
                .select("lecture_id")
                .in("lecture_id", lectureIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        const profilesByUserId = new Map(
          (profilesResult.data ?? []).map((profile) => [
            profile.user_id,
            profile,
          ])
        );
        const scholarsById = new Map(
          scholarProfiles.map((scholar) => [
            scholar.id,
            scholar,
          ])
        );

        const reflectionVideos: UnifiedVideo[] =
          reflectionRows.map((video) => {
            const profile = profilesByUserId.get(
              video.user_id
            );

            return {
              key: `reflection:${video.id}`,
              source: "reflection",
              id: video.id,
              ownerId: video.user_id,
              scholarId: null,
              title: video.title,
              description: video.caption,
              category: video.category,
              language: video.language,
              videoUrl: video.video_url,
              thumbnailUrl: video.thumbnail_url,
              trimStartSeconds: Number(
                video.trim_start_seconds ?? 0
              ),
              trimEndSeconds:
                video.trim_end_seconds === null
                  ? null
                  : Number(video.trim_end_seconds),
              createdAt: video.created_at,
              captionsEnabled:
                video.captions_enabled ?? false,
              captionsSegments:
                video.captions_segments,
              ownerName:
                profile?.full_name ||
                profile?.username ||
                t("reflections.tariqIslamCreator", {
                  defaultValue:
                    "Tariq Islam Creator",
                }),
              ownerAvatarUrl:
                profile?.avatar_url ?? null,
              ownerVerified:
                profile?.is_creator_verified ??
                false,
            };
          });

        const scholarVideos: UnifiedVideo[] = lectureRows
          .map((lecture) => {
            const scholar = scholarsById.get(
              lecture.scholar_id
            );

            if (!scholar) {
              return null;
            }

            const profile = profilesByUserId.get(
              scholar.user_id
            );

            return {
              key: `scholar:${lecture.id}`,
              source: "scholar" as const,
              id: lecture.id,
              ownerId: scholar.user_id,
              scholarId: scholar.id,
              title: lecture.title,
              description: lecture.description,
              category: lecture.category,
              language: lecture.language,
              videoUrl: lecture.video_url,
              thumbnailUrl: lecture.thumbnail_url,
              trimStartSeconds: 0,
              trimEndSeconds: null,
              createdAt: lecture.created_at,
              captionsEnabled:
                lecture.captions_enabled ?? false,
              captionsSegments:
                lecture.captions_segments,
              ownerName: scholar.display_name,
              ownerAvatarUrl:
                profile?.avatar_url ?? null,
              ownerVerified: true,
            };
          })
          .filter(
            (
              video
            ): video is UnifiedVideo =>
              video !== null
          );

        const unifiedVideos = [
          ...reflectionVideos,
          ...scholarVideos,
        ].sort(
          (first, second) =>
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
        );

        const translationsMap: Record<
          string,
          CaptionTranslation[]
        > = {};

        unifiedVideos.forEach((video) => {
          translationsMap[video.key] = [];
        });

        (
          reflectionTranslationsResult.data ?? []
        ).forEach((row) => {
          translationsMap[
            `reflection:${row.reflection_id}`
          ].push({
            language_code: row.language_code,
            language_name: row.language_name,
            translated_segments:
              normalizeCaptionSegments(
                row.translated_segments
              ),
          });
        });

        (scholarTranslationsResult.data ?? []).forEach(
          (row) => {
            translationsMap[
              `scholar:${row.lecture_id}`
            ].push({
              language_code: row.language_code,
              language_name: row.language_name,
              translated_segments:
                normalizeCaptionSegments(
                  row.translated_segments
                ),
            });
          }
        );

        const nextLikeCounts: Record<string, number> = {};
        const nextCommentCounts: Record<string, number> = {};
        const nextLikedVideoKeys: string[] = [];

        unifiedVideos.forEach((video) => {
          nextLikeCounts[video.key] = 0;
          nextCommentCounts[video.key] = 0;
        });

        (reflectionLikesResult.data ?? []).forEach(
          (row) => {
            const key = `reflection:${row.reflection_id}`;
            nextLikeCounts[key] =
              (nextLikeCounts[key] ?? 0) + 1;

            if (user?.id && row.user_id === user.id) {
              nextLikedVideoKeys.push(key);
            }
          }
        );

        (scholarLikesResult.data ?? []).forEach(
          (row) => {
            const key = `scholar:${row.lecture_id}`;
            nextLikeCounts[key] =
              (nextLikeCounts[key] ?? 0) + 1;

            if (user?.id && row.user_id === user.id) {
              nextLikedVideoKeys.push(key);
            }
          }
        );

        (reflectionCommentsResult.data ?? []).forEach(
          (row) => {
            const key = `reflection:${row.reflection_id}`;
            nextCommentCounts[key] =
              (nextCommentCounts[key] ?? 0) + 1;
          }
        );

        (scholarCommentsResult.data ?? []).forEach(
          (row) => {
            const key = `scholar:${row.lecture_id}`;
            nextCommentCounts[key] =
              (nextCommentCounts[key] ?? 0) + 1;
          }
        );

        setVideos(unifiedVideos);
        setTranslationsByVideoKey(translationsMap);
        setLikeCounts(nextLikeCounts);
        setCommentCounts(nextCommentCounts);
        setLikedVideoKeys(nextLikedVideoKeys);
        setActiveVideoKey((current) =>
          current &&
          unifiedVideos.some(
            (video) => video.key === current
          )
            ? current
            : unifiedVideos[0]?.key ?? null
        );
      } catch (error) {
        console.error(
          "Unable to load featured videos:",
          error
        );
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    void loadVideos();
  }, [t, user?.id]);

  useEffect(() => {
    if (
      loading ||
      videos.length === 0 ||
      commentsOpen
    ) {
      if (commentsOpen) {
        videoRefs.current.forEach((video) =>
          video.pause()
        );
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

        const videoKey = (
          mostVisible.target as HTMLElement
        ).dataset.videoKey;

        if (!videoKey) {
          return;
        }

        setActiveVideoKey(videoKey);

        videoRefs.current.forEach((video, key) => {
          if (key === videoKey) {
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
      "[data-video-key]"
    );

    cards?.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      videoRefs.current.forEach((video) =>
        video.pause()
      );
    };
  }, [
    videos,
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

  const getCategoryLabel = (
    category: string | null
  ) => {
    if (!category) {
      return "";
    }

    const normalized = category.trim().toLowerCase();
    const categoryKeys: Record<string, string> = {
      lecture: "reflections.categories.lecture",
      "daily reminder":
        "reflections.categories.dailyReminder",
      quran: "reflections.categories.quran",
      hadith: "reflections.categories.hadith",
      prayer: "reflections.categories.prayer",
      recitation: "reflections.categories.recitation",
    };
    const translationKey = categoryKeys[normalized];

    return translationKey
      ? t(translationKey, {
          defaultValue: category,
        })
      : category;
  };

  const getLanguageLabel = (
    language: string | null
  ) => {
    if (!language) {
      return "";
    }

    const normalized = language.trim().toLowerCase();
    const languageKeys: Record<string, string> = {
      english: "reflections.languages.english",
      arabic: "reflections.languages.arabic",
      french: "reflections.languages.french",
      hausa: "reflections.languages.hausa",
      yoruba: "reflections.languages.yoruba",
    };
    const translationKey = languageKeys[normalized];

    return translationKey
      ? t(translationKey, {
          defaultValue: language,
        })
      : language;
  };

  const handleCaptionPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    videoKey: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const position = captionPositions[videoKey] ?? {
      x: 0,
      y: 0,
    };

    captionDragRef.current = {
      videoKey,
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
      [drag.videoKey]: {
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

  useEffect(() => {
    const loadSavedVideos = async () => {
      if (!user?.id || videos.length === 0) {
        setSavedVideoKeys([]);
        return;
      }

      const reflectionIds = videos
        .filter((video) => video.source === "reflection")
        .map((video) => video.id);

      const lectureIds = videos
        .filter((video) => video.source === "scholar")
        .map((video) => video.id);

      const [reflectionSavesResult, lectureSavesResult] =
        await Promise.all([
          reflectionIds.length > 0
            ? supabase
                .from("reflection_saves")
                .select("reflection_id")
                .eq("user_id", user.id)
                .in("reflection_id", reflectionIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
          lectureIds.length > 0
            ? supabase
                .from("scholar_lecture_saves")
                .select("lecture_id")
                .eq("user_id", user.id)
                .in("lecture_id", lectureIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

      if (reflectionSavesResult.error) {
        console.error(
          "Unable to load saved reflections:",
          reflectionSavesResult.error
        );
      }

      if (lectureSavesResult.error) {
        console.error(
          "Unable to load saved scholar lectures:",
          lectureSavesResult.error
        );
      }

      const reflectionKeys = (
        reflectionSavesResult.data ?? []
      ).map(
        (row) => `reflection:${row.reflection_id}`
      );

      const lectureKeys = (
        lectureSavesResult.data ?? []
      ).map(
        (row) => `scholar:${row.lecture_id}`
      );

      setSavedVideoKeys([
        ...reflectionKeys,
        ...lectureKeys,
      ]);
    };

    void loadSavedVideos();
  }, [user?.id, videos]);

  const playNextVideo = (videoKey: string) => {
    const currentIndex = videos.findIndex(
      (video) => video.key === videoKey
    );
    const nextVideo =
      videos[currentIndex + 1] ?? videos[0];

    document
      .getElementById(
        `featured-video-${nextVideo.key.replace(
          ":",
          "-"
        )}`
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const handleSave = async (video: UnifiedVideo) => {
    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (savingVideoKeys.includes(video.key)) {
      return;
    }

    const isSaved = savedVideoKeys.includes(video.key);

    setSavingVideoKeys((current) => [
      ...current,
      video.key,
    ]);

    try {
      if (video.source === "reflection") {
        if (isSaved) {
          const { error } = await supabase
            .from("reflection_saves")
            .delete()
            .eq("reflection_id", video.id)
            .eq("user_id", user.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase
            .from("reflection_saves")
            .upsert(
              {
                reflection_id: video.id,
                user_id: user.id,
              },
              {
                onConflict: "user_id,reflection_id",
                ignoreDuplicates: true,
              }
            );

          if (error) {
            throw error;
          }
        }
      } else if (isSaved) {
        const { error } = await supabase
          .from("scholar_lecture_saves")
          .delete()
          .eq("lecture_id", video.id)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("scholar_lecture_saves")
          .upsert(
            {
              lecture_id: video.id,
              user_id: user.id,
            },
            {
              onConflict: "user_id,lecture_id",
              ignoreDuplicates: true,
            }
          );

        if (error) {
          throw error;
        }
      }

      setSavedVideoKeys((current) =>
        isSaved
          ? current.filter((key) => key !== video.key)
          : current.includes(video.key)
            ? current
            : [...current, video.key]
      );

      toast({
        title: isSaved
          ? t("reflections.removedFromSaved", {
              defaultValue: "Removed from saved",
            })
          : t("reflections.saved", {
              defaultValue: "Video saved",
            }),
      });
    } catch (error) {
      console.error("Unable to update saved video:", error);

      toast({
        title: t("reflections.saveError", {
          defaultValue: "Unable to save video",
        }),
        variant: "destructive",
      });
    } finally {
      setSavingVideoKeys((current) =>
        current.filter((key) => key !== video.key)
      );
    }
  };

  const handleLike = async (video: UnifiedVideo) => {
    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (likingVideoKeys.includes(video.key)) {
      return;
    }

    const isLiked = likedVideoKeys.includes(video.key);
    setLikingVideoKeys((current) => [
      ...current,
      video.key,
    ]);

    try {
      if (video.source === "reflection") {
        if (isLiked) {
          const { error } = await supabase
            .from("reflection_likes")
            .delete()
            .eq("reflection_id", video.id)
            .eq("user_id", user.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase
            .from("reflection_likes")
            .insert({
              reflection_id: video.id,
              user_id: user.id,
            });

          if (error) {
            throw error;
          }
        }
      } else if (isLiked) {
        const { error } = await supabase
          .from("scholar_lecture_likes")
          .delete()
          .eq("lecture_id", video.id)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("scholar_lecture_likes")
          .insert({
            lecture_id: video.id,
            user_id: user.id,
          });

        if (error) {
          throw error;
        }
      }

      setLikedVideoKeys((current) =>
        isLiked
          ? current.filter((key) => key !== video.key)
          : [...current, video.key]
      );
      setLikeCounts((current) => ({
        ...current,
        [video.key]: Math.max(
          0,
          (current[video.key] ?? 0) +
            (isLiked ? -1 : 1)
        ),
      }));
    } catch (error) {
      console.error("Unable to update video like:", error);
      toast({
        title: t("reflections.likeError", {
          defaultValue: "Unable to update like",
        }),
        variant: "destructive",
      });
    } finally {
      setLikingVideoKeys((current) =>
        current.filter((key) => key !== video.key)
      );
    }
  };

  const loadComments = async (video: UnifiedVideo) => {
    setCommentsLoading(true);

    try {
      const commentResult =
        video.source === "reflection"
          ? await supabase
              .from("reflection_comments")
              .select(
                "id,user_id,content,created_at"
              )
              .eq("reflection_id", video.id)
              .order("created_at", {
                ascending: true,
              })
          : await supabase
              .from("scholar_lecture_comments")
              .select(
                "id,user_id,content,created_at"
              )
              .eq("lecture_id", video.id)
              .order("created_at", {
                ascending: true,
              });

      if (commentResult.error) {
        throw commentResult.error;
      }

      const commentRows = commentResult.data ?? [];
      const userIds = Array.from(
        new Set(
          commentRows.map((comment) => comment.user_id)
        )
      );

      const profileResult =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select(
                "user_id,full_name,username,avatar_url"
              )
              .in("user_id", userIds)
          : { data: [], error: null };

      if (profileResult.error) {
        console.error(
          "Unable to load comment profiles:",
          profileResult.error
        );
      }

      const profileRows = profileResult.data ?? [];
      const nextComments = commentRows.map((comment) => ({
        ...comment,
        profiles:
          profileRows.find(
            (profile) =>
              profile.user_id === comment.user_id
          ) ?? null,
      })) as UnifiedComment[];

      setComments(nextComments);
      setCommentCounts((current) => ({
        ...current,
        [video.key]: nextComments.length,
      }));
    } catch (error) {
      console.error("Unable to load comments:", error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenComments = (video: UnifiedVideo) => {
    setSelectedCommentVideo(video);
    setCommentsOpen(true);
    setComments([]);
    void loadComments(video);
  };

  const handleCommentSubmit = async () => {
    if (!selectedCommentVideo) {
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
      const insertResult =
        selectedCommentVideo.source === "reflection"
          ? await supabase
              .from("reflection_comments")
              .insert({
                reflection_id: selectedCommentVideo.id,
                user_id: user.id,
                content,
              })
          : await supabase
              .from("scholar_lecture_comments")
              .insert({
                lecture_id: selectedCommentVideo.id,
                user_id: user.id,
                content,
              });

      if (insertResult.error) {
        throw insertResult.error;
      }

      setNewComment("");
      await loadComments(selectedCommentVideo);
      setCommentsOpen(false);
      setSelectedCommentVideo(null);
    } catch (error) {
      console.error("Unable to add comment:", error);
      toast({
        title: t("reflections.commentAddError", {
          defaultValue: "Unable to add comment",
        }),
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (
    commentId: string
  ) => {
    if (!user?.id || !selectedCommentVideo) {
      return;
    }

    const deleteResult =
      selectedCommentVideo.source === "reflection"
        ? await supabase
            .from("reflection_comments")
            .delete()
            .eq("id", commentId)
            .eq("user_id", user.id)
        : await supabase
            .from("scholar_lecture_comments")
            .delete()
            .eq("id", commentId)
            .eq("user_id", user.id);

    if (deleteResult.error) {
      console.error(
        "Unable to delete comment:",
        deleteResult.error
      );
      return;
    }

    await loadComments(selectedCommentVideo);
  };

  const handleShare = async (video: UnifiedVideo) => {
    const shareUrl =
      video.source === "scholar" && video.scholarId
        ? `${window.location.origin}/scholars/` +
          `${video.scholarId}/lectures/${video.id}`
        : `${window.location.origin}/reflections#reflection-${video.id}`;
    const shareText = `${video.title} by ${video.ownerName}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: video.title,
          text: shareText,
          url: shareUrl,
          dialogTitle: t("reflections.share", {
            defaultValue: "Share",
          }),
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t("reflections.linkCopied", {
          defaultValue: "Link copied",
        }),
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

      console.error("Unable to share video:", error);
    }
  };

  const navigateToOwner = (video: UnifiedVideo) => {
    if (video.source === "scholar" && video.scholarId) {
      navigate(`/scholars/${video.scholarId}`);
      return;
    }

    if (video.ownerId) {
      navigate(`/creator/${video.ownerId}`);
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));

  return (
    <section className="px-4 py-6">
      <div className="relative mx-auto max-w-4xl">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
            <Video className="h-4 w-4 text-islamic-gold" />
            {t("reflections.featuredReflections")}
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl bg-black/40 p-8 text-white/80">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("reflections.loadingReflections")}
            </div>
          ) : videos.length > 0 ? (
            <div
              ref={feedRef}
              className="h-[78dvh] min-h-[560px] snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-2xl bg-black"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollSnapType: "y mandatory",
              }}
            >
              {videos.map((video) => {
                const isActive =
                  activeVideoKey === video.key;
                const originalCaptionSegments =
                  normalizeCaptionSegments(
                    video.captionsSegments
                  );
                const translations =
                  translationsByVideoKey[video.key] ?? [];
                const selectedCaptionLanguage =
                  selectedCaptionLanguages[video.key] ??
                  (originalCaptionSegments.length > 0
                    ? "original"
                    : translations[0]?.language_code ??
                      "off");
                const selectedTranslation =
                  translations.find(
                    (translation) =>
                      translation.language_code ===
                      selectedCaptionLanguage
                  );
                const activeSegments =
                  selectedCaptionLanguage === "off"
                    ? []
                    : selectedCaptionLanguage ===
                        "original"
                      ? originalCaptionSegments
                      : selectedTranslation
                          ?.translated_segments ?? [];
                const currentTime =
                  videoTimes[video.key] ?? 0;
                const activeCaption =
                  activeSegments.find(
                    (segment) =>
                      currentTime >= segment.start &&
                      currentTime < segment.end
                  )?.text ?? "";
                const hasCaptionChoices =
                  originalCaptionSegments.length > 0 ||
                  translations.some(
                    (translation) =>
                      Array.isArray(
                        translation.translated_segments
                      ) &&
                      translation.translated_segments
                        .length > 0
                  );
                const captionsCollapsed =
                  collapsedCaptions[video.key] ?? false;
                const captionPosition =
                  captionPositions[video.key] ?? {
                    x: 0,
                    y: 0,
                  };

                return (
                  <article
                    id={`featured-video-${video.key.replace(
                      ":",
                      "-"
                    )}`}
                    key={video.key}
                    data-video-key={video.key}
                    className="flex h-full min-h-full snap-start snap-always flex-col bg-black"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigateToOwner(video)
                      }
                      className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-islamic-green/55 px-4 py-3 text-left text-white"
                    >
                      {video.ownerAvatarUrl ? (
                        <img
                          src={video.ownerAvatarUrl}
                          alt={video.ownerName}
                          className="h-11 w-11 rounded-full border border-white/20 object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-islamic-green font-bold text-white">
                          {video.ownerName
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) =>
                              part[0]?.toUpperCase()
                            )
                            .join("") || "T"}
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {video.ownerName}
                          {video.ownerVerified ? " ✓" : ""}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/75">
                          {[
                            getCategoryLabel(
                              video.category
                            ),
                            getLanguageLabel(
                              video.language
                            ),
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </span>
                    </button>

                    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
                      <video
                        ref={(node) => {
                          if (node) {
                            videoRefs.current.set(
                              video.key,
                              node
                            );
                          } else {
                            videoRefs.current.delete(
                              video.key
                            );
                          }
                        }}
                        src={video.videoUrl}
                        poster={
                          video.thumbnailUrl ?? undefined
                        }
                        muted={!soundEnabled}
                        playsInline
                        preload={
                          isActive ? "auto" : "metadata"
                        }
                        crossOrigin="anonymous"
                        className="h-full w-full select-none bg-black object-contain"
                        onLoadedMetadata={(event) => {
                          const element =
                            event.currentTarget;

                          if (
                            video.trimStartSeconds > 0 &&
                            video.trimStartSeconds <
                              element.duration
                          ) {
                            element.currentTime =
                              video.trimStartSeconds;
                          }
                        }}
                        onPlay={(event) => {
                          const element =
                            event.currentTarget;

                          videoRefs.current.forEach(
                            (otherVideo, key) => {
                              if (
                                key !== video.key
                              ) {
                                otherVideo.pause();
                              }
                            }
                          );

                          if (
                            element.currentTime <
                              video.trimStartSeconds ||
                            (video.trimEndSeconds !==
                              null &&
                              element.currentTime >=
                                video.trimEndSeconds)
                          ) {
                            element.currentTime =
                              video.trimStartSeconds;
                          }
                        }}
                        onTimeUpdate={(event) => {
                          const element =
                            event.currentTarget;
                          const nextTime =
                            element?.currentTime ?? 0;

                          setVideoTimes((current) => ({
                            ...current,
                            [video.key]: nextTime,
                          }));

                          if (
                            video.trimEndSeconds !==
                              null &&
                            nextTime >=
                              video.trimEndSeconds -
                                0.1
                          ) {
                            element.pause();
                            playNextVideo(video.key);
                          }
                        }}
                        onEnded={() =>
                          playNextVideo(video.key)
                        }
                        onClick={(event) => {
                          const element =
                            event.currentTarget;

                          if (element.paused) {
                            void element.play();
                          } else {
                            element.pause();
                          }
                        }}
                      />

                      {isActive &&
                        hasCaptionChoices && (
                          <div
                            className="absolute left-1/2 top-[38%] z-20 w-[calc(100%-5rem)] max-w-lg"
                            style={{
                              transform:
                                `translate(calc(-50% + ${captionPosition.x}px), ` +
                                `${captionPosition.y}px)`,
                            }}
                          >
                            <div className="overflow-hidden rounded-xl border border-white/20 bg-black/80 text-white shadow-xl backdrop-blur-md">
                              <div className="flex items-center gap-2 border-b border-white/10 p-2">
                                <button
                                  type="button"
                                  onPointerDown={(
                                    event
                                  ) =>
                                    handleCaptionPointerDown(
                                      event,
                                      video.key
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
                                    "reflections.moveCaptions",
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
                                        [video.key]:
                                          event.target
                                            .value,
                                      })
                                    )
                                  }
                                  onClick={(event) =>
                                    event.stopPropagation()
                                  }
                                  className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
                                  aria-label={t(
                                    "reflections.captionLanguage",
                                    {
                                      defaultValue:
                                        "Caption language",
                                    }
                                  )}
                                >
                                  <option value="off">
                                    {t(
                                      "reflections.captionsOff",
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
                                        "reflections.original",
                                        {
                                          defaultValue:
                                            "Original",
                                        }
                                      )}
                                    </option>
                                  )}

                                  {translations.map(
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
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setCollapsedCaptions(
                                      (current) => ({
                                        ...current,
                                        [video.key]:
                                          !captionsCollapsed,
                                      })
                                    );
                                  }}
                                  className="rounded-md bg-white/10 p-1.5 text-white/80"
                                  aria-label={
                                    captionsCollapsed
                                      ? t(
                                          "reflections.expandCaptions",
                                          {
                                            defaultValue:
                                              "Expand captions",
                                          }
                                        )
                                      : t(
                                          "reflections.collapseCaptions",
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
                                    className="max-h-28 overflow-y-auto px-3 py-2 text-center text-sm font-medium leading-relaxed sm:text-base"
                                  >
                                    {activeCaption || (
                                      <span className="text-white/50">
                                        {t(
                                          "reflections.captionsWillAppear",
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

                      <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3">
                        <button
                          type="button"
                          disabled={likingVideoKeys.includes(
                            video.key
                          )}
                          onClick={() =>
                            void handleLike(video)
                          }
                          className="flex h-13 min-w-13 flex-col items-center justify-center rounded-full bg-black/65 px-2 py-2 text-white shadow-xl backdrop-blur-md"
                          aria-label={t(
                            "reflections.like",
                            {
                              defaultValue: "Like",
                            }
                          )}
                        >
                          <Heart
                            className={`h-6 w-6 ${
                              likedVideoKeys.includes(
                                video.key
                              )
                                ? "fill-red-500 text-red-500"
                                : ""
                            }`}
                          />
                          <span className="text-xs font-bold">
                            {likeCounts[video.key] ?? 0}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleOpenComments(video)
                          }
                          className="flex h-13 min-w-13 flex-col items-center justify-center rounded-full bg-black/65 px-2 py-2 text-white shadow-xl backdrop-blur-md"
                          aria-label={t(
                            "reflections.comments",
                            {
                              defaultValue:
                                "Comments",
                            }
                          )}
                        >
                          <MessageCircle className="h-6 w-6" />
                          <span className="text-xs font-bold">
                            {commentCounts[video.key] ??
                              0}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={savingVideoKeys.includes(
                            video.key
                          )}
                          onClick={() =>
                            void handleSave(video)
                          }
                          className="flex h-13 min-w-13 flex-col items-center justify-center rounded-full bg-black/65 px-2 py-2 text-white shadow-xl backdrop-blur-md"
                          aria-label={
                            savedVideoKeys.includes(video.key)
                              ? t(
                                  "reflections.removeFromSaved",
                                  {
                                    defaultValue:
                                      "Remove from saved",
                                  }
                                )
                              : t(
                                  "reflections.save",
                                  {
                                    defaultValue:
                                      "Save video",
                                  }
                                )
                          }
                        >
                          {savingVideoKeys.includes(
                            video.key
                          ) ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <Bookmark
                              className={`h-6 w-6 ${
                                savedVideoKeys.includes(
                                  video.key
                                )
                                  ? "fill-yellow-400 text-yellow-400"
                                  : ""
                              }`}
                            />
                          )}

                          <span className="text-[10px] font-semibold">
                            {savedVideoKeys.includes(video.key)
                              ? "Saved"
                              : "Save"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleShare(video)
                          }
                          className="flex h-13 min-w-13 items-center justify-center rounded-full bg-black/65 p-3 text-white shadow-xl backdrop-blur-md"
                          aria-label={t(
                            "reflections.share",
                            {
                              defaultValue: "Share",
                            }
                          )}
                        >
                          <Share2 className="h-6 w-6" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSoundEnabled(
                              (current) => !current
                            )
                          }
                          className="flex h-13 min-w-13 items-center justify-center rounded-full bg-black/65 p-3 text-white shadow-xl backdrop-blur-md"
                          aria-label={
                            soundEnabled
                              ? t(
                                  "reflections.mute",
                                  {
                                    defaultValue:
                                      "Mute video",
                                  }
                                )
                              : t(
                                  "reflections.sound",
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
                          {video.category && (
                            <span className="rounded-full bg-islamic-green/90 px-3 py-1 text-xs font-semibold text-white">
                              {getCategoryLabel(
                                video.category
                              )}
                            </span>
                          )}
                          {video.language && (
                            <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-xs font-semibold">
                              {getLanguageLabel(
                                video.language
                              )}
                            </span>
                          )}
                        </div>

                        <h2 className="line-clamp-2 text-xl font-bold drop-shadow-lg">
                          {video.title}
                        </h2>

                        {video.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow">
                            {video.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-black/40 p-8 text-center">
              <PlayCircle className="mx-auto mb-3 h-14 w-14 text-islamic-gold" />
              <div className="font-semibold">
                {t("reflections.noApprovedReflections")}
              </div>
              <p className="mt-2 text-sm text-white/70">
                {t("reflections.uploadAfterApproval")}
              </p>
            </div>
          )}

          <Button
            type="button"
            onClick={() =>
              navigate("/upload-reflection")
            }
            className="mt-4 w-full bg-islamic-green text-white hover:bg-islamic-green/90"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("reflections.uploadReflection")}
          </Button>

          <Button
            type="button"
            onClick={() => navigate("/reflections")}
            className="mt-3 w-full bg-islamic-gold text-black hover:bg-islamic-gold/90"
          >
            {t("reflections.seeAllReflections")}
          </Button>

          <div className="mt-4">
            <h2 className="text-2xl font-bold">
              {t("reflections.strengthenConnection")}
            </h2>
            <p className="mt-2 text-white/80">
              {t("reflections.communityReminders")}
            </p>
          </div>
        </div>
      </div>

      {commentsOpen && selectedCommentVideo && (
        <div
          className="fixed inset-0 z-[9999] flex items-end bg-black/65 sm:items-center sm:justify-center sm:p-4"
          onPointerDown={() => {
            setCommentsOpen(false);
            setSelectedCommentVideo(null);
          }}
          role="presentation"
        >
          <section
            className="max-h-[70dvh] w-full overflow-hidden rounded-t-2xl bg-background text-foreground shadow-2xl sm:max-w-2xl sm:rounded-2xl"
            onPointerDown={(event) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-label={t("reflections.comments", {
              defaultValue: "Comments",
            })}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="h-5 w-5" />
                  {t("reflections.comments", {
                    defaultValue: "Comments",
                  })}
                </h2>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {selectedCommentVideo.title}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCommentsOpen(false);
                  setSelectedCommentVideo(null);
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
                  {t("reflections.loadingComments", {
                    defaultValue: "Loading comments",
                  })}
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8" />
                  {t("reflections.noComments", {
                    defaultValue: "No comments yet",
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const commenterName =
                      comment.profiles?.full_name ||
                      comment.profiles?.username ||
                      t("reflections.member", {
                        defaultValue: "Member",
                      });
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
                          "reflections.writeComment",
                          {
                            defaultValue:
                              "Write a comment",
                          }
                        )
                      : t(
                          "reflections.signInToComment",
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
    </section>
  );
}
