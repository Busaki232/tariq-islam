import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Eye,
  Flag,
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type ReflectionVideo = {
  id: string;
  user_id: string;
  title: string;
  caption: string | null;
  category: string;
  language: string;
  video_url: string;
};

type FeedCache = {
  savedAt: number;
  videos: ReflectionVideo[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  viewCounts: Record<string, number>;
};

const PAGE_SIZE = 20;
const FEED_CACHE_KEY = "tariq_reflections_feed_cache_v2";
const FEED_CACHE_MAX_AGE = 5 * 60 * 1000;

const saveFeedCache = (payload: Omit<FeedCache, "savedAt">) => {
  localStorage.setItem(
    FEED_CACHE_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      ...payload,
    })
  );
};

const readFeedCache = (): FeedCache | null => {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as FeedCache;

    if (Date.now() - parsed.savedAt > FEED_CACHE_MAX_AGE) {
      localStorage.removeItem(FEED_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(FEED_CACHE_KEY);
    return null;
  }
};

export default function ReflectionsFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetVideoId = searchParams.get("video");
  const { user } = useAuth();
  const { t } = useTranslation("common");

  const [videos, setVideos] = useState<ReflectionVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<ReflectionVideo | null>(
    null
  );
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [heartVideoId, setHeartVideoId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const viewTimers = useRef<Record<string, number>>({});
  const lastTapRef = useRef<Record<string, number>>({});
  const pullStartY = useRef(0);
  const pullTriggered = useRef(false);
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reportVideo, setReportVideo] = useState<ReflectionVideo | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportComment, setReportComment] = useState<any | null>(null);



  const preloadNextVideo = useCallback(
    (currentVideoId: string) => {
      const currentIndex = videos.findIndex((v) => v.id === currentVideoId);
      if (currentIndex === -1) return;

      const nextVideo = videos[currentIndex + 1];
      if (!nextVideo) return;

      if (!preloadVideoRef.current) {
        preloadVideoRef.current = document.createElement("video");
      }

      preloadVideoRef.current.src = nextVideo.video_url;
      preloadVideoRef.current.preload = "auto";
      preloadVideoRef.current.load();
    },
    [videos]
  );

  const loadVideos = useCallback(
    async (reset = false) => {
      if (loadingMore && !reset) return;

      try {
        if (reset) {
          setLoading(true);
          setPage(0);
          setHasMore(true);

          const cached = readFeedCache();

          if (cached) {
            setVideos(cached.videos);
            setLikeCounts(cached.likeCounts);
            setCommentCounts(cached.commentCounts);
            setViewCounts(cached.viewCounts);
          }
        } else {
          setLoadingMore(true);
        }

        const currentPage = reset ? 0 : page;

        const { data: videoRows, error } = await supabase
          .from("reflection_videos")
          .select("id,user_id,title,caption,category,language,video_url")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(
            currentPage * PAGE_SIZE,
            currentPage * PAGE_SIZE + PAGE_SIZE - 1
          );

        if (error) throw error;

        if (!videoRows || videoRows.length === 0) {
          setHasMore(false);
          return;
        }

        const videoIds = videoRows.map((video) => video.id);
const [
  { data: likes },
  { data: commentsData },
  { data: views },
  { data: saves },
] = await Promise.all([
  supabase
    .from("reflection_likes")
    .select("reflection_id,user_id")
    .in("reflection_id", videoIds),

  supabase
    .from("reflection_comments")
    .select("reflection_id")
    .in("reflection_id", videoIds),

  supabase
    .from("reflection_views")
    .select("reflection_id")
    .in("reflection_id", videoIds),

  user?.id
    ? supabase
        .from("reflection_saves")
        .select("reflection_id")
        .eq("user_id", user.id)
        .in("reflection_id", videoIds)
    : Promise.resolve({ data: [] }),
]);

        const nextLikeCounts: Record<string, number> = {};
        const nextCommentCounts: Record<string, number> = {};
        const nextViewCounts: Record<string, number> = {};

        videoIds.forEach((id) => {
          nextLikeCounts[id] = 0;
          nextCommentCounts[id] = 0;
          nextViewCounts[id] = 0;
        });

        likes?.forEach((row) => {
          nextLikeCounts[row.reflection_id] =
            (nextLikeCounts[row.reflection_id] ?? 0) + 1;
        });

        commentsData?.forEach((row) => {
          nextCommentCounts[row.reflection_id] =
            (nextCommentCounts[row.reflection_id] ?? 0) + 1;
        });

        views?.forEach((row) => {
          nextViewCounts[row.reflection_id] =
            (nextViewCounts[row.reflection_id] ?? 0) + 1;
        });


if (user) {
  const userLikedIds =
    likes
      ?.filter((row) => row.user_id === user.id)
      .map((row) => row.reflection_id) ?? [];

  setLikedIds((prev) =>
    reset
      ? userLikedIds
      : Array.from(new Set([...prev, ...userLikedIds]))
  );

  const userSavedIds =
    saves?.map((row) => row.reflection_id) ?? [];

  setSavedIds((prev) =>
    reset
      ? userSavedIds
      : Array.from(new Set([...prev, ...userSavedIds]))
  );
} else if (reset) {
  setLikedIds([]);
  setSavedIds([]);
}

        if (reset) {
          setVideos(videoRows);
          setLikeCounts(nextLikeCounts);
          setCommentCounts(nextCommentCounts);
          setViewCounts(nextViewCounts);

          saveFeedCache({
            videos: videoRows,
            likeCounts: nextLikeCounts,
            commentCounts: nextCommentCounts,
            viewCounts: nextViewCounts,
          });
        } else {
          setVideos((prev) => [...prev, ...videoRows]);
          setLikeCounts((prev) => ({ ...prev, ...nextLikeCounts }));
          setCommentCounts((prev) => ({ ...prev, ...nextCommentCounts }));
          setViewCounts((prev) => ({ ...prev, ...nextViewCounts }));
        }

        setPage(currentPage + 1);

        if (videoRows.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Failed to load reflections:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loadingMore, page, user]
  );

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    localStorage.removeItem(FEED_CACHE_KEY);

    try {
      await loadVideos(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadVideos]);

  useEffect(() => {
    void loadVideos(true);
  }, []);

useEffect(() => {
  if (!targetVideoId || loading || videos.length === 0) return;

  const targetElement = document.getElementById(
    `reflection-${targetVideoId}`
  );

  if (!targetElement) return;

  window.requestAnimationFrame(() => {
    targetElement.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  });
}, [targetVideoId, loading, videos]);


const handleShare = async (video: ReflectionVideo) => {
  const reflectionUrl = `${window.location.origin}/reflections?video=${video.id}`;

  const shareText = video.caption
    ? `${video.title}\n\n${video.caption}`
    : video.title;

  try {
    if (navigator.share) {
      await navigator.share({
        title: video.title,
        text: shareText,
        url: reflectionUrl,
      });
    } else {
      await navigator.clipboard.writeText(reflectionUrl);

      alert(
        t("reflections.videoLinkCopied", {
          defaultValue: "Reflection link copied.",
        })
      );
    }
  } catch (error: any) {
    if (error?.name === "AbortError") return;

    console.error("Failed to share reflection:", error);
  }
};

  const handleLike = async (videoId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const alreadyLiked = likedIds.includes(videoId);

    if (alreadyLiked) {
      const { error } = await supabase
        .from("reflection_likes")
        .delete()
        .eq("reflection_id", videoId)
        .eq("user_id", user.id);

      if (!error) {
        setLikedIds((prev) => prev.filter((id) => id !== videoId));
        setLikeCounts((prev) => ({
          ...prev,
          [videoId]: Math.max((prev[videoId] ?? 1) - 1, 0),
        }));
      }
    } else {
      const { error } = await supabase.from("reflection_likes").insert({
        reflection_id: videoId,
        user_id: user.id,
      });

      if (!error) {
        setLikedIds((prev) => [...prev, videoId]);
        setLikeCounts((prev) => ({
          ...prev,
          [videoId]: (prev[videoId] ?? 0) + 1,
        }));
      }
    }
  };
const handleSaveVideo = async (videoId: string) => {
  if (!user?.id) {
    navigate("/auth");
    return;
  }

  const alreadySaved = savedIds.includes(videoId);

  if (alreadySaved) {
    const { error } = await supabase
      .from("reflection_saves")
      .delete()
      .eq("reflection_id", videoId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to remove saved reflection:", error);
      return;
    }

    setSavedIds((prev) => prev.filter((id) => id !== videoId));
    return;
  }

  const { error } = await supabase
    .from("reflection_saves")
    .insert({
      reflection_id: videoId,
      user_id: user.id,
    });

  if (error) {
    if (error.code !== "23505") {
      console.error("Failed to save reflection:", error);
    }
    return;
  }

  setSavedIds((prev) =>
    prev.includes(videoId) ? prev : [...prev, videoId]
  );
};
const handleSubmitVideoReport = async () => {
  if (!user?.id) {
    navigate("/auth");
    return;
  }

  if (!reportVideo || !reportReason) return;

  const description = reportDescription.trim();

  if (description.length < 10) {
    alert(
      t("reflections.reportDescriptionMinimum", {
        defaultValue: "Please enter at least 10 characters.",
      })
    );
    return;
  }

  if (reportVideo.user_id === user.id) {
    alert(
      t("reflections.cannotReportOwnVideo", {
        defaultValue: "You cannot report your own video.",
      })
    );
    return;
  }

  setSubmittingReport(true);

  try {
    const { error } = await supabase.from("reports").insert({
      reported_by: user.id,
      reported_user_id: reportVideo.user_id,
      content_type: "video",
      content_id: reportVideo.id,
      report_type: reportReason,
      description,
    });

    if (error) {
      console.error("Failed to report video:", error);

      alert(
        error.code === "23505"
          ? t("reflections.videoAlreadyReported", {
              defaultValue: "You have already reported this video.",
            })
          : t("reflections.reportFailed", {
              defaultValue: "Failed to submit report.",
            })
      );

      return;
    }

    alert(
      t("reflections.reportSubmitted", {
        defaultValue: "Report submitted.",
      })
    );

    setReportVideo(null);
    setReportReason("");
    setReportDescription("");
  } finally {
    setSubmittingReport(false);
  }
};

  const loadComments = async (video: ReflectionVideo) => {
    const { data: commentRows, error } = await supabase
      .from("reflection_comments")
      .select("id, comment, created_at, user_id")
      .eq("reflection_id", video.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setComments([]);
      setSelectedVideo(video);
      setCommentsOpen(true);
      return;
    }

    const userIds = [...new Set((commentRows ?? []).map((c) => c.user_id))];

    let profileRows: any[] = [];

    if (userIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, username, avatar_url")
        .in("user_id", userIds);

      profileRows = data ?? [];
    }

    const commentsWithProfiles = (commentRows ?? []).map((comment) => ({
      ...comment,
      profiles:
        profileRows.find((profile) => profile.user_id === comment.user_id) ??
        null,
    }));

    setComments(commentsWithProfiles);
    setSelectedVideo(video);
    setCommentsOpen(true);
  };

  const handleCommentSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!selectedVideo || !newComment.trim()) return;

    const { error } = await supabase.from("reflection_comments").insert({
      reflection_id: selectedVideo.id,
      user_id: user.id,
      comment: newComment.trim(),
    });

    if (!error) {
      setNewComment("");
      await loadComments(selectedVideo);

      setCommentCounts((prev) => ({
        ...prev,
        [selectedVideo.id]: (prev[selectedVideo.id] ?? 0) + 1,
      }));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !selectedVideo) return;

    const { error } = await supabase
      .from("reflection_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (!error) {
      await loadComments(selectedVideo);

      setCommentCounts((prev) => ({
        ...prev,
        [selectedVideo.id]: Math.max((prev[selectedVideo.id] ?? 1) - 1, 0),
      }));
    }
  };
const handleSubmitCommentReport = async () => {
  if (!user?.id || !reportComment) return;

  if (reportComment.user_id === user.id) {
    alert(t("reflections.cannotReportOwnComment"));
    return;
  }

  if (reportDescription.trim().length < 10) {
    alert(t("reflections.reportDescriptionMinimum"));
    return;
  }

  setSubmittingReport(true);

  try {
    const { error } = await supabase.from("reports").insert({
      reported_by: user.id,
      reported_user_id: reportComment.user_id,
      content_type: "comment",
      content_id: reportComment.id,
      report_type: reportReason,
      description: reportDescription.trim(),
    });

    if (error) throw error;

    alert(t("reflections.reportSubmitted"));

    setReportComment(null);
    setReportReason("");
    setReportDescription("");
  } catch (error) {
    console.error(error);
    alert(t("reflections.reportFailed"));
  } finally {
    setSubmittingReport(false);
  }
};

const handleStartEditComment = (commentId: string, currentComment: string) => {
  setEditingCommentId(commentId);
  setEditingCommentText(currentComment);
};

const handleCancelEditComment = () => {
  setEditingCommentId(null);
  setEditingCommentText("");
};

const handleSaveEditedComment = async () => {
  if (!user?.id || !selectedVideo || !editingCommentId) return;

  const trimmedComment = editingCommentText.trim();

  if (!trimmedComment) {
    alert(t("reflections.commentCannotBeEmpty", {
      defaultValue: "Comment cannot be empty.",
    }));
    return;
  }

  const { error } = await supabase
    .from("reflection_comments")
    .update({
      comment: trimmedComment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editingCommentId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to edit comment:", error);
    alert(
      t("reflections.editCommentFailed", {
        defaultValue: "Failed to update comment.",
      })
    );
    return;
  }

  setEditingCommentId(null);
  setEditingCommentText("");

  await loadComments(selectedVideo);
};

  const handleView = (videoId: string) => {
    if (viewedIds.includes(videoId)) return;
    if (viewTimers.current[videoId]) return;

    viewTimers.current[videoId] = window.setTimeout(async () => {
      preloadNextVideo(videoId);

      if (!user?.id) {
        delete viewTimers.current[videoId];
        return;
      }

      const { error } = await supabase
        .from("reflection_views")
        .insert({
          reflection_id: videoId,
          user_id: user.id,
        });

      if (!error) {
        setViewedIds((prev) =>
          prev.includes(videoId) ? prev : [...prev, videoId]
        );

        setViewCounts((prev) => ({
          ...prev,
          [videoId]: (prev[videoId] ?? 0) + 1,
        }));
      } else if (error.code === "23505") {
        setViewedIds((prev) =>
          prev.includes(videoId) ? prev : [...prev, videoId]
        );
      } else {
        console.error("Failed to record reflection view:", error);
      }

      delete viewTimers.current[videoId];
    }, 3000);
  };

  const handleDoubleTapLike = async (videoId: string) => {
    setHeartVideoId(videoId);

    window.setTimeout(() => {
      setHeartVideoId(null);
    }, 700);

    if (!likedIds.includes(videoId)) {
      await handleLike(videoId);
    }
  };

  const handleVideoTap = async (videoId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[videoId] || 0;

    if (now - lastTap < 300) {
      await handleDoubleTapLike(videoId);
    }

    lastTapRef.current[videoId] = now;
  };


useEffect(() => {
  const overlaysOpen =
    commentsOpen || Boolean(reportVideo) || Boolean(reportComment);

  if (overlaysOpen) {
    Object.values(videoRefs.current).forEach((video) => {
      video?.pause();
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        const videoId = video.dataset.videoId;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          Object.values(videoRefs.current).forEach((otherVideo) => {
            if (otherVideo && otherVideo !== video) {
              otherVideo.pause();
            }
          });

          video.play().catch(() => {});

          if (videoId) {
            preloadNextVideo(videoId);
          }
        } else {
          video.pause();
        }
      });
    },
    {
      threshold: [0, 0.7, 1],
    }
  );

  Object.values(videoRefs.current).forEach((video) => {
    if (video) {
      observer.observe(video);
    }
  });

  return () => {
    observer.disconnect();
  };
}, [
  videos,
  commentsOpen,
  reportVideo,
  reportComment,
  preloadNextVideo,
]);

  useEffect(() => {
    return () => {
      Object.values(viewTimers.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

useEffect(() => {
  const channel = supabase
    .channel("reflection-likes-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reflection_likes",
      },
      async (payload) => {
        const reflectionId =
          (payload.new as { reflection_id?: string })?.reflection_id ||
          (payload.old as { reflection_id?: string })?.reflection_id;

        if (!reflectionId) return;

        const { count, error } = await supabase
          .from("reflection_likes")
          .select("*", { count: "exact", head: true })
          .eq("reflection_id", reflectionId);

        if (error) {
          console.error("Failed to refresh like count:", error);
          return;
        }

        setLikeCounts((prev) => ({
          ...prev,
          [reflectionId]: count ?? 0,
        }));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, []);
useEffect(() => {
  const channel = supabase
    .channel("reflection-comments-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reflection_comments",
      },
      async (payload) => {
        const reflectionId =
          (payload.new as { reflection_id?: string })?.reflection_id ||
          (payload.old as { reflection_id?: string })?.reflection_id;

        if (!reflectionId) return;

        const { count, error } = await supabase
          .from("reflection_comments")
          .select("*", { count: "exact", head: true })
          .eq("reflection_id", reflectionId);

        if (error) {
          console.error("Failed to refresh comment count:", error);
          return;
        }

        setCommentCounts((prev) => ({
          ...prev,
          [reflectionId]: count ?? 0,
        }));

        if (commentsOpen && selectedVideo?.id === reflectionId) {
          await loadComments(selectedVideo);
        }
      }
    )

.subscribe((status) => {
  console.log("Reflection Likes Realtime:", status);
});
  return () => {
    void supabase.removeChannel(channel);
  };
}, [commentsOpen, selectedVideo]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between bg-black/60 px-4 py-4 backdrop-blur">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("reflections.back")}
        </Button>

        <h1 className="text-lg font-bold">
          {t("reflections.reflectionsTitle")}
        </h1>

        <div className="w-20" />
      </div>

      {loading ? (
        <div className="flex min-h-screen items-center justify-center">
          {t("reflections.loadingReflections")}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          {t("reflections.noApprovedAvailable")}
        </div>
      ) : (
        <div
          className="h-[100dvh] overflow-y-auto snap-y snap-mandatory overscroll-y-contain pt-16 pb-20"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "y mandatory",
          }}
          onScroll={(e) => {
            const target = e.currentTarget;
            const nearBottom =
              target.scrollTop + target.clientHeight >=
              target.scrollHeight - 400;

            if (nearBottom && hasMore && !loadingMore) {
              void loadVideos(false);
            }
          }}
          onTouchStart={(e) => {
            pullStartY.current = e.touches[0].clientY;
            pullTriggered.current = false;
          }}
          onTouchMove={(e) => {
            const target = e.currentTarget;
            const currentY = e.touches[0].clientY;
            const pulledDistance = currentY - pullStartY.current;

            if (
              target.scrollTop <= 0 &&
              pulledDistance > 90 &&
              !pullTriggered.current &&
              !refreshing
            ) {
              pullTriggered.current = true;
              void refreshFeed();
            }
          }}
        >
          {refreshing && (
            <div className="flex justify-center py-4 text-white/70">
              {t("reflections.refreshingReflections")}
            </div>
          )}

          {videos.map((video) => (
  <section
    id={`reflection-${video.id}`}
    key={video.id}
    className="flex h-[100dvh] snap-start items-center justify-center px-4 py-4"
  >
              <div className="relative h-[78dvh] w-full max-w-md overflow-hidden rounded-3xl bg-black shadow-2xl transition-all duration-300">
                <video
                  ref={(el) => {
                    videoRefs.current[video.id] = el;
                  }}
                  src={video.video_url}
                  data-video-id={video.id}
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  controls={false}
                  onPlay={() => handleView(video.id)}
                  onClick={() => handleVideoTap(video.id)}
                  preload="metadata"
                  crossOrigin="anonymous"
                  disablePictureInPicture
                  className="h-full w-full select-none bg-black object-contain"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {heartVideoId === video.id && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className="h-28 w-28 fill-red-500 text-red-500 animate-bounce drop-shadow-2xl" />
                  </div>
                )}

                <div className="absolute bottom-6 left-4 right-20">
                  <div className="mb-2 inline-flex rounded-full bg-islamic-green/90 px-3 py-1 text-xs font-semibold">
                    {video.category} • {video.language}
                  </div>

{video.user_id && (
  <button
    type="button"
    onClick={() => navigate(`/creator/${video.user_id}`)}
    className="mb-2 block text-left text-sm font-semibold text-white hover:underline"
  >
    {t("reflections.viewCreator", {
      defaultValue: "View creator",
    })}
  </button>
)}

                  <h2 className="text-2xl font-bold">{video.title}</h2>


                  {video.caption && (
                    <p className="mt-2 text-sm text-white/85">
                      {video.caption}
                    </p>
                  )}
                </div>

                <div className="absolute bottom-10 right-4 flex flex-col items-center gap-6">
                  <button
                    type="button"
                    onClick={() => handleLike(video.id)}
                    className="flex flex-col items-center text-white"
                  >
                    <Heart
                      className={`h-8 w-8 ${
                        likedIds.includes(video.id)
                          ? "fill-red-500 text-red-500"
                          : ""
                      }`}
                    />
                    <span className="text-xs">
                      {likeCounts[video.id] ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadComments(video)}
                    className="flex flex-col items-center text-white"
                  >
                    <MessageCircle className="h-8 w-8" />
                    <span className="text-xs">
                      {commentCounts[video.id] ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex flex-col items-center text-white"
                  >
                    <Eye className="h-8 w-8" />
                    <span className="text-xs">
                      {viewCounts[video.id] ?? 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveVideo(video.id)}
                    className="flex flex-col items-center text-white"
                    aria-label={
                      savedIds.includes(video.id)
                        ? t("reflections.unsave", { defaultValue: "Unsave" })
                        : t("reflections.saveVideo", { defaultValue: "Save" })
                    }
                  >
                    {savedIds.includes(video.id) ? (
                      <BookmarkCheck className="h-8 w-8 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <Bookmark className="h-8 w-8" />
                    )}

                    <span className="text-xs">
                      {savedIds.includes(video.id)
                        ? t("reflections.saved", { defaultValue: "Saved" })
                        : t("reflections.saveVideo", { defaultValue: "Save" })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user?.id) {
                        navigate("/auth");
                        return;
                      }

                      setReportVideo(video);
                      setReportReason("");
                      setReportDescription("");
                    }}
                    className="flex flex-col items-center text-white"
                    aria-label={t("reflections.report", {
                      defaultValue: "Report",
                    })}
                  >
                   <Flag className="h-8 w-8 text-amber-500" />
                    <span className="text-xs">
                      {t("reflections.report", {
                        defaultValue: "Report",
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShare(video)}
                    className="flex flex-col items-center text-white"
                  >
                    <Share2 className="h-8 w-8" />
                    <span className="text-xs">{t("reflections.share")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMuted((value) => !value)}
                    className="flex flex-col items-center text-white"
                  >
                    {muted ? (
                      <VolumeX className="h-8 w-8" />
                    ) : (
                      <Volume2 className="h-8 w-8" />
                    )}
                <span className="text-xs">
                  {muted
                    ? t("reflections.muted")
                    : t("reflections.sound")}
                </span>
                  </button>
                </div>
              </div>
            </section>
          ))}

          {loadingMore && (
            <div className="flex justify-center py-8 text-white/70">
              {t("reflections.loadingMoreReflections")}
            </div>
          )}
        </div>
      )}

         {commentsOpen && selectedVideo && (
           <div className="fixed inset-0 z-[9999] flex items-end bg-black/70">
             <div className="max-h-[75vh] w-full overflow-y-auto rounded-t-3xl bg-background p-4 text-foreground">
               <div className="mb-4 flex items-center justify-between">
                 <h2 className="text-lg font-bold">
                   {t("reflections.comments")}
                 </h2>

                 <button
                   type="button"
                   onClick={() => {
                     setCommentsOpen(false);
                     setEditingCommentId(null);
                     setEditingCommentText("");
                   }}
                   className="text-sm text-muted-foreground"
                 >
                   {t("reflections.close")}
                 </button>
               </div>

               <div className="mb-4 space-y-3">
                 {comments.length === 0 ? (
                   <p className="text-sm text-muted-foreground">
                     {t("reflections.noCommentsYet")}
                   </p>
                 ) : (
                   comments.map((item) => (
                     <div
                       key={item.id}
                       className="rounded-xl bg-muted p-3 text-sm"
                     >
                       <div className="mb-1 flex items-center gap-2">
                         {item.profiles?.avatar_url ? (
                           <img
                             src={item.profiles.avatar_url}
                             alt=""
                             className="h-7 w-7 rounded-full object-cover"
                           />
                         ) : (
                           <div className="flex h-7 w-7 items-center justify-center rounded-full bg-islamic-green text-xs font-bold text-white">
                             {(item.profiles?.full_name ||
                               item.profiles?.username ||
                               "U")
                               .charAt(0)
                               .toUpperCase()}
                           </div>
                         )}

                         <div>
                           <div className="font-semibold">
                             {item.profiles?.full_name ||
                               item.profiles?.username ||
                               t("reflections.tariqIslamUser")}
                           </div>

                           {item.profiles?.username && (
                             <div className="text-xs text-muted-foreground">
                               @{item.profiles.username}
                             </div>
                           )}
                         </div>
                       </div>

                       {editingCommentId === item.id ? (
                         <div className="mt-2 space-y-2">
                           <textarea
                             value={editingCommentText}
                             onChange={(e) =>
                               setEditingCommentText(e.target.value)
                             }
                             className="min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-sm"
                             autoFocus
                           />

                           <div className="flex gap-2">
                             <button
                               type="button"
                               onClick={() => void handleSaveEditedComment()}
                               disabled={!editingCommentText.trim()}
                               className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
                             >
                               {t("reflections.save")}
                             </button>

                             <button
                               type="button"
                               onClick={handleCancelEditComment}
                               className="rounded-lg border px-3 py-2 text-xs"
                             >
                               {t("reflections.cancel")}
                             </button>
                           </div>
                         </div>
                       ) : (
                         <>
                           <div>{item.comment}</div>

                           <div className="mt-2 flex gap-3">
                             {user?.id === item.user_id ? (
                               <>
                                 <button
                                   type="button"
                                   onClick={() =>
                                     handleStartEditComment(
                                       item.id,
                                       item.comment
                                     )
                                   }
                                   className="text-xs text-primary hover:underline"
                                 >
                                   {t("reflections.edit")}
                                 </button>

                                 <button
                                   type="button"
                                   onClick={() =>
                                     void handleDeleteComment(item.id)
                                   }
                                   className="text-xs text-red-500 hover:underline"
                                 >
                                   {t("reflections.delete")}
                                 </button>
                               </>
                             ) : (
                               <button
                                 type="button"
        onClick={() => {
          if (!user?.id) {
            navigate("/auth");
            return;
          }

          setReportVideo(video);
          setReportComment(null);
          setReportReason("");
          setReportDescription("");
        }}
                                 className="text-xs text-orange-500 hover:underline"
                               >
                                 {t("reflections.report")}
                               </button>
                             )}
                           </div>
                         </>
                       )}
                     </div>
                   ))
                 )}
               </div>

               <div className="flex gap-2">
                 <input
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   placeholder={t("reflections.addComment")}
                   className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
                 />

                 <Button
                   type="button"
                   onClick={() => void handleCommentSubmit()}
                 >
                   {t("reflections.send")}
                 </Button>
               </div>
             </div>
           </div>
         )}

         {(reportVideo || reportComment) && (
           <div className="fixed inset-0 z-[10000] flex items-end bg-black/70">
             <div className="w-full rounded-t-3xl bg-background p-5 text-foreground">
               <div className="mb-4 flex items-center justify-between">
                 <h2 className="text-lg font-bold">
                   {reportVideo
                     ? t("reflections.reportVideo", {
                         defaultValue: "Report Video",
                       })
                     : t("reflections.reportComment", {
                         defaultValue: "Report Comment",
                       })}
                 </h2>

                 <button
                   type="button"
                   onClick={() => {
                     setReportVideo(null);
                     setReportComment(null);
                     setReportReason("");
                     setReportDescription("");
                   }}
                   className="text-sm text-muted-foreground"
                 >
                   {t("reflections.close")}
                 </button>
               </div>

               <select
                 value={reportReason}
                 onChange={(e) => setReportReason(e.target.value)}
                 className="mb-3 w-full rounded-xl border bg-background px-3 py-3"
               >
                 <option value="">
                   {t("reflections.selectReason", {
                     defaultValue: "Select a reason",
                   })}
                 </option>

                 <option value="hate_speech">
                   {t("reflections.hateSpeech", {
                     defaultValue: "Hate speech",
                   })}
                 </option>

                 <option value="extremism">
                   {t("reflections.extremism", {
                     defaultValue: "Extremism",
                   })}
                 </option>

                 <option value="harassment">
                   {t("reflections.harassment", {
                     defaultValue: "Harassment",
                   })}
                 </option>

                 <option value="spam">
                   {t("reflections.spam", {
                     defaultValue: "Spam",
                   })}
                 </option>

                 <option value="violence">
                   {t("reflections.violence", {
                     defaultValue: "Violence",
                   })}
                 </option>

                 <option value="inappropriate_content">
                   {t("reflections.inappropriateContent", {
                     defaultValue: "Inappropriate content",
                   })}
                 </option>

                 <option value="other">
                   {t("reflections.other", {
                     defaultValue: "Other",
                   })}
                 </option>
               </select>

               <textarea
                 value={reportDescription}
                 onChange={(e) => setReportDescription(e.target.value)}
                 placeholder={t("reflections.describeReport", {
                   defaultValue: "Describe the problem",
                 })}
                 maxLength={1000}
                 className="min-h-[110px] w-full rounded-xl border bg-background px-3 py-3"
               />

               <Button
                 type="button"
                 onClick={() => {
                   if (reportVideo) {
                     void handleSubmitVideoReport();
                   } else {
                     void handleSubmitCommentReport();
                   }
                 }}
                 disabled={
                   submittingReport ||
                   !reportReason ||
                   reportDescription.trim().length < 10
                 }
                 className="mt-4 w-full"
               >
                 {submittingReport
                   ? t("reflections.submittingReport", {
                       defaultValue: "Submitting...",
                     })
                   : t("reflections.submitReport", {
                       defaultValue: "Submit Report",
                     })}
               </Button>
             </div>
           </div>
         )}
       </main>
     );
   }