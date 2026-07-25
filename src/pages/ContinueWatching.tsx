import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Loader2,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProgressRow = {
  id: string;
  lecture_id: string;
  current_time_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  updated_at: string;
  lecture: {
    id: string;
    scholar_id: string;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    category: string | null;
    language: string | null;
    status: string;
    scholar: {
      id: string;
      display_name: string;
    } | null;
  } | null;
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const ContinueWatching = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContinueWatching = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("scholar_lecture_progress")
        .select(`
          id,
          lecture_id,
          current_time_seconds,
          duration_seconds,
          completed,
          updated_at,
          lecture:scholar_lectures (
            id,
            scholar_id,
            title,
            description,
            video_url,
            thumbnail_url,
            category,
            language,
            status,
            scholar:scholar_profiles (
              id,
              display_name
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("completed", false)
        .gt("current_time_seconds", 0)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      const validItems = (data ?? []).filter(
        (item) =>
          item.lecture &&
          item.lecture.status === "approved" &&
          item.current_time_seconds > 0
      );

      setItems(validItems as ProgressRow[]);
    } catch (error: any) {
      console.error("Unable to load continue watching:", error);

      toast({
        title: "Unable to load Continue Watching",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      navigate("/auth");
      return;
    }

    void loadContinueWatching();
  }, [loadContinueWatching, navigate, user?.id]);

  const itemCountLabel = useMemo(() => {
    return items.length === 1 ? "1 lecture" : `${items.length} lectures`;
  }, [items.length]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Badge variant="secondary">{itemCountLabel}</Badge>
        </div>

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Clock3 className="h-7 w-7" />
            Continue Watching
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Resume unfinished scholar lectures from where you stopped.
          </p>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />

              <h2 className="text-lg font-semibold">
                Nothing to continue yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Start watching a scholar lecture and it will appear here
                automatically.
              </p>

              <Button
                type="button"
                className="mt-5"
                onClick={() => navigate("/scholars")}
              >
                Browse Scholars
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const lecture = item.lecture;

              if (!lecture) {
                return null;
              }

              const duration = item.duration_seconds ?? 0;
              const currentTime = item.current_time_seconds;

              const rawProgress =
                duration > 0 ? (currentTime / duration) * 100 : 0;

              const progressPercent = Math.min(
                100,
                Math.max(0, rawProgress)
              );

              const openLecture = () => {
                navigate(
                  `/scholars/${lecture.scholar_id}/lectures/${lecture.id}`
                );
              };

              return (
                <Card
                  key={item.id}
                  className="overflow-hidden"
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={openLecture}
                  >
                    <div className="relative aspect-video bg-muted">
                      {lecture.thumbnail_url ? (
                        <img
                          src={lecture.thumbnail_url}
                          alt={lecture.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={lecture.video_url}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="rounded-full bg-background/90 p-3 shadow">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${progressPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>

                  <CardContent className="space-y-4 p-4">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={openLecture}
                    >
                      <h2 className="line-clamp-2 font-semibold">
                        {lecture.title}
                      </h2>

                      {lecture.scholar?.display_name && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {lecture.scholar.display_name}
                        </p>
                      )}

                      {lecture.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {lecture.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
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
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {formatDuration(currentTime)} watched
                          </span>

                          <span>
                            {duration > 0
                              ? `${Math.round(progressPercent)}%`
                              : "In progress"}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${progressPercent}%`,
                            }}
                          />
                        </div>
                      </div>
                    </button>

                    <Button
                      type="button"
                      className="w-full"
                      onClick={openLecture}
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Resume
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default ContinueWatching;