import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Loader2,
  MapPin,
  Play,
  Share2,
  Heart,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

 console.log("Lecture view count check:", {
   lectureIdFromUrl: lectureId,
   lectureIdFromDatabase: lectureData.id,
   count: lectureViewCount,
   error: viewCountError,
 });

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
          .limit(6),
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
    setRelatedLectures((relatedResult.data ?? []) as RelatedLecture[]);

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
        setScholarAvatarUrl(
          scholarUserProfile?.avatar_url ?? null
        );
      }
    } else {
      setScholarAvatarUrl(null);
    }
    } catch (error: any) {
      console.error("Unable to load scholar lecture:", error);

      toast({
        title: "Unable to load lecture",
        description:
          error?.message || "The lecture could not be opened.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [lectureId, scholarId, toast]);



useEffect(() => {
  setViewRecorded(false);
  setViewCount(0);
  setLikeCount(0);
  setIsLiked(false);
  setIsSaved(false);
  setScholarAvatarUrl(null);
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
        title: "Lecture link copied",
        description: "The lecture link was copied to your clipboard.",
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("Unable to share lecture:", error);

      toast({
        title: "Unable to share",
        description: "The lecture link could not be shared.",
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

  // A returned row means this was a new view.
  // An empty array means this user already viewed the lecture.
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
      ...new Set((commentRows ?? []).map((comment) => comment.user_id)),
    ];

    let profileRows: Array<{
      user_id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    }> = [];

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, username, avatar_url")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Unable to load comment profiles:", profilesError);
      } else {
        profileRows = profilesData ?? [];
      }
    }

    const commentsWithProfiles = (commentRows ?? []).map((comment) => ({
      ...comment,
      profiles:
        profileRows.find(
          (profile) => profile.user_id === comment.user_id
        ) ?? null,
    }));

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
      title: "Unable to update like",
      description: error?.message || "Please try again.",
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
        title: "Removed from saved lectures",
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
        title: "Lecture saved",
      });
    }
  } catch (error: any) {
    console.error("Unable to update saved lecture:", error);

    toast({
      title: "Unable to update saved lecture",
      description: error?.message || "Please try again.",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};

const handleCommentSubmit = async () => {
  if (!lectureId) {
    return;
  }

  if (!user?.id) {
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
  } catch (error: any) {
    console.error("Unable to add lecture comment:", error);

    toast({
      title: "Unable to add comment",
      description: error?.message || "Please try again.",
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
      title: "Unable to delete comment",
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
          <span>Loading lecture...</span>
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
              Lecture unavailable
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              This lecture may be unavailable, removed, or awaiting approval.
            </p>

            <Button
              type="button"
              className="mt-6"
              onClick={() =>
                navigate(
                  scholarId ? `/scholars/${scholarId}` : "/scholars"
                )
              }
            >
              Return to Scholar
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/scholars/${lecture.scholar_id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button
            type="button"
            variant={isSaved ? "default" : "outline"}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <Bookmark
              className={`mr-2 h-4 w-4 ${
                isSaved ? "fill-current" : ""
              }`}
            />

            {isSaved ? "Saved" : "Save"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleShare()}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
<div className="overflow-hidden rounded-2xl border bg-black shadow-sm">
  <video
  ref={videoRef}
    key={lecture.id}
    src={lecture.video_url}
    poster={lecture.thumbnail_url ?? undefined}
    controls
    playsInline
    preload="metadata"
    onLoadedMetadata={(event) => {
      void restoreLectureProgress(event.currentTarget);
    }}

    onTimeUpdate={(event) => {
      const video = event.currentTarget;

      if (!user?.id || !Number.isFinite(video.duration)) {
        return;
      }

      if (
        video.currentTime - lastProgressSaveRef.current >= 10
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

  if (video.currentTime > 0 && video.currentTime < video.duration) {
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
   }}
    className="aspect-video w-full bg-black object-contain"
  >
    Your browser does not support video playback.
  </video>
</div>

<div className="flex flex-wrap items-center gap-3">
  <Button
    type="button"
    variant={isLiked ? "default" : "outline"}
    onClick={() => void handleLike()}
    disabled={liking}
  >
    <Heart
      className={`mr-2 h-4 w-4 ${
        isLiked ? "fill-current" : ""
      }`}
    />

    {likeCount.toLocaleString()}{" "}
    {likeCount === 1 ? "Like" : "Likes"}
  </Button>

  <Button
    type="button"
    variant="outline"
    onClick={() =>
      commentsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  >
    <MessageCircle className="mr-2 h-4 w-4" />

    {commentCount.toLocaleString()}{" "}
    {commentCount === 1 ? "Comment" : "Comments"}
  </Button>

  <Button
    type="button"
    variant="outline"
    onClick={() => void handleShare()}
  >
    <Share2 className="mr-2 h-4 w-4" />
    Share
  </Button>
</div>

<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
  <section className="space-y-6">
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {lecture.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
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

            <span className="text-sm text-muted-foreground">
              {viewCount.toLocaleString()}{" "}
              {viewCount === 1 ? "view" : "views"}
            </span>

            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {formatDate(lecture.created_at)}
            </span>
          </div>
        </div>

        {lecture.description ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground sm:text-base">
            {lecture.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No description was provided for this lecture.
          </p>
        )}
      </CardContent>
    </Card>

    <div ref={commentsSectionRef} className="scroll-mt-24">
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5" />
              Comments
            </h2>

            <p className="text-sm text-muted-foreground">
              {commentCount.toLocaleString()}{" "}
              {commentCount === 1 ? "comment" : "comments"}
            </p>
          </div>

          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(event) =>
                setNewComment(event.target.value)
              }
              placeholder={
                user?.id
                  ? "Write a comment..."
                  : "Sign in to comment"
              }
              disabled={!user?.id || submittingComment}
              maxLength={1000}
              rows={3}
              className="min-h-[88px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <Button
              type="button"
              size="icon"
              onClick={() => void handleCommentSubmit()}
              disabled={
                !user?.id ||
                !newComment.trim() ||
                submittingComment
              }
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {commentsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />

              <p className="text-sm text-muted-foreground">
                No comments yet. Start the discussion.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const commenterName =
                  comment.profiles?.full_name ||
                  comment.profiles?.username ||
                  "Tariq Islam Member";

                const commenterInitials = commenterName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("");

                return (
                  <div
                    key={comment.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
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

                    <div className="min-w-0 flex-1">
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
                            className="h-8 w-8 text-destructive"
                            onClick={() =>
                              void handleDeleteComment(
                                comment.id
                              )
                            }
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        {comment.content}
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(comment.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {scholar && (
      <Card>
        <CardContent className="p-5 sm:p-6">
          <button
            type="button"
            className="flex w-full items-start gap-4 text-left"
            onClick={() =>
              navigate(`/scholars/${scholar.id}`)
            }
          >
      <Avatar className="h-16 w-16 shrink-0">
        <AvatarImage
          src={scholarAvatarUrl ?? undefined}
          alt={scholar.display_name}
          className="object-cover"
        />

        <AvatarFallback>
          {scholarInitials}
        </AvatarFallback>
      </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  {scholar.display_name}
                </h2>

                <BadgeCheck className="h-5 w-5 text-primary" />
              </div>

              {(scholar.city || scholar.country) && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />

                  {[scholar.city, scholar.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              {scholar.biography && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {scholar.biography}
                </p>
              )}
            </div>
          </button>
        </CardContent>
      </Card>
    )}
  </section>

          <aside>
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="font-semibold">
                    More from this Scholar
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Continue learning from this scholar.
                  </p>
                </div>

                {relatedLectures.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-8 text-center">
                    <BookOpen className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />

                    <p className="text-sm text-muted-foreground">
                      No other approved lectures yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {relatedLectures.map((relatedLecture) => (
                      <button
                        key={relatedLecture.id}
                        type="button"
                        className="w-full overflow-hidden rounded-xl border text-left transition hover:bg-muted/50"
                        onClick={() =>
                          navigate(
                            `/scholars/${relatedLecture.scholar_id}/lectures/${relatedLecture.id}`
                          )
                        }
                      >
                        <div className="relative aspect-video bg-muted">
                     {relatedLecture.thumbnail_url ? (
                       <img
                         src={relatedLecture.thumbnail_url}
                         alt={relatedLecture.title}
                         className="h-full w-full object-cover"
                       />
                     ) : (
                       <video
                         src={relatedLecture.video_url}
                         preload="metadata"
                         muted
                         playsInline
                         className="h-full w-full object-cover"
                       />
                     )}

                     <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                       <div className="rounded-full bg-background/90 p-3 shadow">
                         <Play className="h-6 w-6 fill-current" />
                       </div>
                     </div>
                        </div>

                        <div className="space-y-2 p-3">
                          <p className="line-clamp-2 text-sm font-medium">
                            {relatedLecture.title}
                          </p>

                          <div className="flex flex-wrap gap-2">
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
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default ScholarLectureViewer;