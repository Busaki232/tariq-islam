import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  CalendarDays,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type SavedLectureRow = {
  id: string;
  created_at: string;
  lecture_id: string;
  lecture: {
    id: string;
    scholar_id: string;
    title: string;
    description: string | null;
    category: string | null;
    language: string | null;
    video_url: string;
    thumbnail_url: string | null;
    created_at: string;
    status: string;
  } | null;
};

const formatDate = (dateValue: string) => {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
};

const SavedScholarLectures = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [savedLectures, setSavedLectures] = useState<SavedLectureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSavedLectures = useCallback(async () => {
    if (!user?.id) {
      setSavedLectures([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("scholar_lecture_saves")
        .select(`
          id,
          created_at,
          lecture_id,
          lecture:scholar_lectures (
            id,
            scholar_id,
            title,
            description,
            category,
            language,
            video_url,
            thumbnail_url,
            created_at,
            status
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const validRows = (data ?? []).filter(
        (row) => row.lecture && row.lecture.status === "approved"
      );

      setSavedLectures(validRows as SavedLectureRow[]);
    } catch (error: any) {
      console.error("Unable to load saved lectures:", error);

      toast({
        title: "Unable to load saved lectures",
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

    void loadSavedLectures();
  }, [loadSavedLectures, navigate, user?.id]);

  const handleRemove = async (
    saveId: string,
    lectureTitle: string
  ) => {
    if (!user?.id || removingId) {
      return;
    }

    setRemovingId(saveId);

    try {
      const { error } = await supabase
        .from("scholar_lecture_saves")
        .delete()
        .eq("id", saveId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setSavedLectures((current) =>
        current.filter((item) => item.id !== saveId)
      );

      toast({
        title: "Removed from saved lectures",
        description: lectureTitle,
      });
    } catch (error: any) {
      console.error("Unable to remove saved lecture:", error);

      toast({
        title: "Unable to remove lecture",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

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
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Badge variant="secondary">
            {savedLectures.length.toLocaleString()}{" "}
            {savedLectures.length === 1
              ? "saved lecture"
              : "saved lectures"}
          </Badge>
        </div>

 <div>
   <h1 className="text-2xl font-bold">
     Saved Scholar Lectures
   </h1>
 </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Lectures you saved for later.
          </p>
        </div>

        {savedLectures.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />

              <h2 className="text-lg font-semibold">
                No saved lectures yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Open a scholar lecture and tap Save to add it here.
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
            {savedLectures.map((savedItem) => {
              const lecture = savedItem.lecture;

              if (!lecture) {
                return null;
              }

              return (
                <Card
                  key={savedItem.id}
                  className="overflow-hidden"
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() =>
                      navigate(
                        `/scholars/${lecture.scholar_id}/lectures/${lecture.id}`
                      )
                    }
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
                        <div className="rounded-full bg-background/90 p-3">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      </div>
                    </div>
                  </button>

                  <CardContent className="space-y-4 p-4">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        navigate(
                          `/scholars/${lecture.scholar_id}/lectures/${lecture.id}`
                        )
                      }
                    >
                      <h2 className="line-clamp-2 font-semibold">
                        {lecture.title}
                      </h2>

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

                      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(lecture.created_at)}
                      </p>
                    </button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() =>
                        void handleRemove(
                          savedItem.id,
                          lecture.title
                        )
                      }
                      disabled={removingId === savedItem.id}
                    >
                      {removingId === savedItem.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}

                      Remove
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </main>
  );
};

export default SavedScholarLectures;