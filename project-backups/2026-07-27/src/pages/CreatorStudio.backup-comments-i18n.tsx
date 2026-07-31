import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bookmark,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CreatorReflection = {
  id: string;
  title: string;
  caption: string | null;
  category: string;
  language: string;
  video_url: string;
  thumbnail_url: string | null;
  trim_start_seconds: number;
  trim_end_seconds: number | null;
  reference_type: string | null;
  quran_surah_number: number | null;
  quran_ayah_start: number | null;
  quran_ayah_end: number | null;
  hadith_collection: string | null;
  hadith_number: string | null;
  reference_note: string | null;
  status: string;
  created_at: string;
};

export default function CreatorStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { toast } = useToast();

  const [reflections, setReflections] = useState<CreatorReflection[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [viewsLast7Days, setViewsLast7Days] = useState(0);
  const [viewsLast30Days, setViewsLast30Days] = useState(0);
  const [likesLast7Days, setLikesLast7Days] = useState(0);
  const [commentsLast7Days, setCommentsLast7Days] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending" | "draft" | "rejected"
  >("all");


  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const loadStudio = async () => {
      setLoading(true);

      try {
const { data: reflectionRows, error: reflectionError } =
  await supabase
    .from("reflection_videos")
   .select(
     "id,title,caption,category,language,video_url,thumbnail_url,trim_start_seconds,trim_end_seconds,reference_type,quran_surah_number,quran_ayah_start,quran_ayah_end,hadith_collection,hadith_number,reference_note,status,created_at"
   )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

        if (reflectionError) throw reflectionError;

        const loadedReflections = reflectionRows ?? [];
        const reflectionIds = loadedReflections.map((item) => item.id);

        if (!active) return;

        setReflections(loadedReflections);

        if (reflectionIds.length === 0) {
          setViewCounts({});
          setLikeCounts({});
          setCommentCounts({});
          setSaveCounts({});
          setViewsLast7Days(0);
          setViewsLast30Days(0);
          setLikesLast7Days(0);
          setCommentsLast7Days(0);
          return;
        }

       const [viewsResult, likesResult, commentsResult, savesResult] =
         await Promise.all([
          supabase
        .from("reflection_views")
        .select("reflection_id,created_at")
            .in("reflection_id", reflectionIds),

          supabase
         .from("reflection_likes")
         .select("reflection_id,created_at")
            .in("reflection_id", reflectionIds),

          supabase
         .from("reflection_comments")
         .select("reflection_id,created_at")
            .in("reflection_id", reflectionIds),

            supabase
          .from("reflection_comments")
          .select("reflection_id,created_at")
              .in("reflection_id", reflectionIds),
        ]);

        if (viewsResult.error) throw viewsResult.error;
        if (likesResult.error) throw likesResult.error;
        if (commentsResult.error) throw commentsResult.error;
        if (savesResult.error) throw savesResult.error;

        const makeCounts = (rows: Array<{ reflection_id: string }>) =>
          rows.reduce<Record<string, number>>((counts, row) => {
            counts[row.reflection_id] =
              (counts[row.reflection_id] ?? 0) + 1;
            return counts;
          }, {});

        if (!active) return;

        setViewCounts(makeCounts(viewsResult.data ?? []));
        setLikeCounts(makeCounts(likesResult.data ?? []));
        setCommentCounts(makeCounts(commentsResult.data ?? []));
        setSaveCounts(makeCounts(savesResult.data ?? []));
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const countSince = (
          rows: Array<{ created_at: string }>,
          since: number
        ) =>
          rows.filter((row) => {
            const createdAt = new Date(row.created_at).getTime();
            return Number.isFinite(createdAt) && createdAt >= since;
          }).length;

        setViewsLast7Days(
          countSince(viewsResult.data ?? [], sevenDaysAgo)
        );

        setViewsLast30Days(
          countSince(viewsResult.data ?? [], thirtyDaysAgo)
        );

        setLikesLast7Days(
          countSince(likesResult.data ?? [], sevenDaysAgo)
        );

        setCommentsLast7Days(
          countSince(commentsResult.data ?? [], sevenDaysAgo)
        );
      } catch (error) {
        console.error("Creator Studio load error:", error);

        toast({
          title: "Could not load Creator Studio",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadStudio();



    return () => {
      active = false;
    };
  }, [user?.id, toast]);

const filteredReflections = reflections.filter((reflection) => {
  if (statusFilter === "all") return true;
  return reflection.status === statusFilter;
});

const handleStatusFilter = (
  status: "all" | "approved" | "pending" | "draft" | "rejected"
) => {
  setStatusFilter(status);

  window.setTimeout(() => {
    document
      .getElementById("my-reflections")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
};




  const totals = useMemo(
    () => ({
      published: reflections.filter((item) => item.status === "approved")
        .length,
      pending: reflections.filter((item) => item.status === "pending").length,
      drafts: reflections.filter((item) => item.status === "draft").length,
      rejected: reflections.filter((item) => item.status === "rejected")
        .length,
      views: Object.values(viewCounts).reduce(
        (sum, value) => sum + value,
        0
      ),
      likes: Object.values(likeCounts).reduce(
        (sum, value) => sum + value,
        0
      ),
      comments: Object.values(commentCounts).reduce(
        (sum, value) => sum + value,
        0
      ),
    }),
    [reflections, viewCounts, likeCounts, commentCounts, saveCounts]
  );

const topReflection = useMemo(() => {
  const eligibleReflections = reflections.filter(
    (reflection) =>
      reflection.status === "approved" ||
      reflection.status === "pending"
  );

  if (eligibleReflections.length === 0) {
    return null;
  }

  return eligibleReflections
    .map((reflection) => {
      const views = viewCounts[reflection.id] ?? 0;
      const likes = likeCounts[reflection.id] ?? 0;
      const comments = commentCounts[reflection.id] ?? 0;
      const saves = saveCounts[reflection.id] ?? 0;

      const engagementScore =
        views + likes * 3 + comments * 4 + saves * 5;

      return {
        reflection,
        views,
        likes,
        comments,
        saves,
        engagementScore,
      };
    })
    .sort(
      (first, second) =>
        second.engagementScore - first.engagementScore
    )[0];
}, [
  reflections,
  viewCounts,
  likeCounts,
  commentCounts,
  saveCounts,
]);

const topFiveReflections = useMemo(() => {
  return reflections
    .filter(
      (reflection) =>
        reflection.status === "approved" ||
        reflection.status === "pending"
    )
    .map((reflection) => {
      const views = viewCounts[reflection.id] ?? 0;
      const likes = likeCounts[reflection.id] ?? 0;
      const comments = commentCounts[reflection.id] ?? 0;
      const saves = saveCounts[reflection.id] ?? 0;

      return {
        reflection,
        views,
        likes,
        comments,
        saves,
        engagementScore:
          views + likes * 3 + comments * 4 + saves * 5,
      };
    })
    .sort(
      (first, second) =>
        second.engagementScore - first.engagementScore
    )
    .slice(0, 5);
}, [
  reflections,
  viewCounts,
  likeCounts,
  commentCounts,
  saveCounts,
]);

  const handleDelete = async (reflection: CreatorReflection) => {
    const confirmed = window.confirm(
      `Delete "${reflection.title}" permanently?`
    );

    if (!confirmed) return;

    setDeletingId(reflection.id);

    try {
      const { error } = await supabase
        .from("reflection_videos")
        .delete()
        .eq("id", reflection.id)
        .eq("user_id", user?.id ?? "");

      if (error) throw error;

      setReflections((current) =>
        current.filter((item) => item.id !== reflection.id)
      );

      toast({
        title: "Reflection deleted",
      });
    } catch (error) {
      console.error("Delete reflection error:", error);

      toast({
        title: "Could not delete reflection",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const statusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    if (status === "pending") return "secondary";
    return "outline";
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Creator Studio</h1>
            <p className="text-muted-foreground">
              Manage reflections and review creator performance.
            </p>
          </div>

          <Button onClick={() => navigate("/upload-reflection")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Reflection
          </Button>
        </div>

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
   <StudioStat
     label="Published"
     value={totals.published}
     icon={<Video className="h-5 w-5" />}
     onClick={() => handleStatusFilter("approved")}
   />

   <StudioStat
     label="Pending"
     value={totals.pending}
     icon={<Clock className="h-5 w-5" />}
     onClick={() => handleStatusFilter("pending")}
   />

<StudioStat
  label="Drafts"
  value={totals.drafts}
  icon={<Clock className="h-5 w-5" />}
  onClick={() => handleStatusFilter("draft")}
/>
        <StudioStat
          label="Rejected"
          value={totals.rejected}
          icon={<Video className="h-5 w-5" />}
          onClick={() => handleStatusFilter("rejected")}
        />

          <StudioStat
            label="Views"
            value={totals.views}
            icon={<Eye className="h-5 w-5" />}
          />

          <StudioStat
            label="Likes"
            value={totals.likes}
            icon={<Heart className="h-5 w-5" />}
          />

          <StudioStat
            label="Comments"
            value={totals.comments}
            icon={<MessageCircle className="h-5 w-5" />}
          />
          <StudioStat
            label="Saves"
            value={totals.saves}
            icon={<Bookmark className="h-5 w-5" />}
          />
          <StudioStat
            label="Views, Last 7 Days"
            value={viewsLast7Days}
            icon={<Eye className="h-5 w-5" />}
          />

          <StudioStat
            label="Views, Last 30 Days"
            value={viewsLast30Days}
            icon={<Eye className="h-5 w-5" />}
          />

          <StudioStat
            label="Likes, Last 7 Days"
            value={likesLast7Days}
            icon={<Heart className="h-5 w-5" />}
          />

          <StudioStat
            label="Comments, Last 7 Days"
            value={commentsLast7Days}
            icon={<MessageCircle className="h-5 w-5" />}
          />
        </div>

        {topReflection && (
          <Card className="border-islamic-green/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Top Performing Reflection
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {topReflection.reflection.thumbnail_url ? (
                  <img
                    src={topReflection.reflection.thumbnail_url}
                    alt={topReflection.reflection.title}
                    className="h-28 w-full rounded-xl object-cover sm:w-40"
                  />
                ) : (
                  <video
                    src={topReflection.reflection.video_url}
                    className="h-28 w-full rounded-xl bg-black object-cover sm:w-40"
                    muted
                    playsInline
                  />
                )}

                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {topReflection.reflection.title}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {topReflection.reflection.category} •{" "}
                    {topReflection.reflection.language}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
                    <div className="rounded-lg bg-muted p-2">
                      <Eye className="mx-auto mb-1 h-4 w-4" />
                      {topReflection.views}
                    </div>

                    <div className="rounded-lg bg-muted p-2">
                      <Heart className="mx-auto mb-1 h-4 w-4" />
                      {topReflection.likes}
                    </div>

                    <div className="rounded-lg bg-muted p-2">
                      <MessageCircle className="mx-auto mb-1 h-4 w-4" />
                      {topReflection.comments}
                    </div>

                    <div className="rounded-lg bg-muted p-2">
                      <Bookmark className="mx-auto mb-1 h-4 w-4" />
                      {topReflection.saves}
                    </div>

                    <div className="rounded-lg bg-muted p-2">
                      <Video className="mx-auto mb-1 h-4 w-4" />
                      {topReflection.engagementScore}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

    {topFiveReflections.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Reflections</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {topFiveReflections.map((item, index) => (
            <div
              key={item.reflection.id}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-islamic-green/10 font-bold text-islamic-green">
                {index + 1}
              </div>

              {item.reflection.thumbnail_url ? (
                <img
                  src={item.reflection.thumbnail_url}
                  alt={item.reflection.title}
                  className="h-14 w-20 rounded-lg object-cover"
                />
              ) : (
                <video
                  src={item.reflection.video_url}
                  className="h-14 w-20 rounded-lg bg-black object-cover"
                  muted
                  playsInline
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {item.reflection.title}
                </p>

                <p className="text-xs text-muted-foreground">
                  {item.views} views • {item.likes} likes •{" "}
                  {item.comments} comments • {item.saves} saves
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold">
                  {item.engagementScore}
                </p>
                <p className="text-xs text-muted-foreground">
                  Score
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )}

<section id="my-reflections" className="scroll-mt-4 space-y-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 className="text-xl font-semibold">My Reflections</h2>

    <Button
      type="button"
      variant="outline"
      onClick={() => setStatusFilter("all")}
    >
      All Reflections
    </Button>
  </div>



          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading Creator Studio...
              </CardContent>
            </Card>
          ) : reflections.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

                <p className="font-medium">
                  You have not created any reflections.
                </p>

                <Button
                  className="mt-4"
                  onClick={() => navigate("/upload-reflection")}
                >
                  Create Your First Reflection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {filteredReflections.map((reflection) => (
                <Card key={reflection.id} className="overflow-hidden">
  <video
    src={reflection.video_url}
    poster={reflection.thumbnail_url ?? undefined}
    controls
    playsInline
    preload="metadata"
    crossOrigin="anonymous"
    onLoadedMetadata={(event) => {
      const video = event.currentTarget;
      const start = Number(reflection.trim_start_seconds ?? 0);

      if (start > 0 && start < video.duration) {
        video.currentTime = start;
      }
    }}
    onPlay={(event) => {
      const video = event.currentTarget;
      const start = Number(reflection.trim_start_seconds ?? 0);
      const end = reflection.trim_end_seconds;

      if (
        video.currentTime < start ||
        (end !== null && video.currentTime >= Number(end))
      ) {
        video.currentTime = start;
      }
    }}
    onTimeUpdate={(event) => {
      const video = event.currentTarget;
      const start = Number(reflection.trim_start_seconds ?? 0);
      const end =
        reflection.trim_end_seconds === null
          ? null
          : Number(reflection.trim_end_seconds);

if (end !== null && video.currentTime >= end) {
  video.currentTime = start;
  void video.play();
}
    }}
    className="aspect-video w-full bg-black object-contain"
  />
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">
                        {reflection.title}
                      </CardTitle>

                      <Badge variant={statusVariant(reflection.status)}>
                        {reflection.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {new Date(reflection.created_at).toLocaleString()}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {reflection.caption && (
                      <p className="text-sm">{reflection.caption}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {reflection.category}
                      </Badge>

                      <Badge variant="outline">
                        {reflection.language}
                      </Badge>
                    </div>

                    {reflection.reference_type === "quran" &&
                      reflection.quran_surah_number &&
                      reflection.quran_ayah_start && (
                        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                          <p className="font-medium">
                            Quran {reflection.quran_surah_number}:
                            {reflection.quran_ayah_start}
                            {reflection.quran_ayah_end &&
                              reflection.quran_ayah_end !==
                                reflection.quran_ayah_start &&
                              `-${reflection.quran_ayah_end}`}
                          </p>

                          {reflection.reference_note && (
                            <p className="mt-1 text-muted-foreground">
                              {reflection.reference_note}
                            </p>
                          )}
                        </div>
                      )}

                    {reflection.reference_type === "hadith" && (
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        <p className="font-medium">
                          {reflection.hadith_collection || "Hadith"}
                          {reflection.hadith_number
                            ? `, Hadith ${reflection.hadith_number}`
                            : ""}
                        </p>

                        {reflection.reference_note && (
                          <p className="mt-1 text-muted-foreground">
                            {reflection.reference_note}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div className="rounded-lg bg-muted p-3">
                        <Eye className="mx-auto mb-1 h-4 w-4" />
                        {viewCounts[reflection.id] ?? 0}
                      </div>


<div className="rounded-lg bg-muted p-3">
  <Bookmark className="mx-auto mb-1 h-4 w-4" />
  {saveCounts[reflection.id] ?? 0}
</div>

                      <div className="rounded-lg bg-muted p-3">
                        <Heart className="mx-auto mb-1 h-4 w-4" />
                        {likeCounts[reflection.id] ?? 0}
                      </div>

                      <div className="rounded-lg bg-muted p-3">
                        <MessageCircle className="mx-auto mb-1 h-4 w-4" />
                        {commentCounts[reflection.id] ?? 0}
                      </div>
                    </div>

           <div className="flex flex-col gap-2 sm:flex-row">
             {reflection.status === "approved" && user?.id && (
               <Button
                 type="button"
                 variant="outline"
                 className="flex-1"
                 onClick={() => navigate(`/creator/${user.id}`)}
               >
                 View Profile
               </Button>
             )}

             {(reflection.status === "draft" ||
               reflection.status === "rejected") && (
               <Button
                 type="button"
                 variant="outline"
                 className="flex-1"
                 onClick={() =>
                   navigate(`/upload-reflection?edit=${reflection.id}`)
                 }
               >
                 <Pencil className="mr-2 h-4 w-4" />
                 Edit
               </Button>
             )}

             {reflection.status === "draft" && (
               <Button
                 type="button"
                 className="flex-1"
                 onClick={async () => {
                   const { error } = await supabase
                     .from("reflection_videos")
                     .update({ status: "pending" })
                     .eq("id", reflection.id)
                     .eq("user_id", user?.id ?? "");

                   if (error) {
                     toast({
                       title: "Could not submit draft",
                       description: error.message,
                       variant: "destructive",
                     });
                     return;
                   }

               setReflections((current) =>
                 current.map((item) =>
                   item.id === reflection.id
                     ? { ...item, status: "pending" }
                     : item
                 )
               );

               handleStatusFilter("pending");

               toast({
                 title: "Draft submitted",
                 description: "Your reflection is now waiting for review.",
               });
                  }}
                >
                  Submit for Review
                </Button>
              )}

              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={deletingId === reflection.id}
                onClick={() => void handleDelete(reflection)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletingId === reflection.id
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StudioStat({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  onClick?: () => void;
}){
  return (
    <Card
      onClick={onClick}
      className={onClick ? "cursor-pointer transition hover:bg-muted/50" : ""}
    >
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>

        <div className="text-islamic-green">{icon}</div>
      </CardContent>
    </Card>
  );
}
