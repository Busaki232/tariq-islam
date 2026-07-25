import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScholarProfileRecord = {
  id: string;
  user_id: string;
  display_name: string;
  verification_status: string;
  is_active: boolean;
};

type LectureRecord = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  created_at: string;
  status: string;
};

const CreateScholarPlaylist = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [scholar, setScholar] =
    useState<ScholarProfileRecord | null>(null);

  const [lectures, setLectures] = useState<LectureRecord[]>([]);
  const [selectedLectureIds, setSelectedLectureIds] = useState<string[]>(
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadPage = async () => {
      if (!scholarId || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

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
            .eq("verification_status", "approved")
            .eq("is_active", true)
            .maybeSingle();

        if (scholarError) {
          throw scholarError;
        }

        if (!scholarData) {
          setScholar(null);
          return;
        }

        setScholar(scholarData as ScholarProfileRecord);

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
                created_at,
                status
              `
            )
            .eq("scholar_id", scholarId)
            .eq("status", "approved")
            .order("created_at", { ascending: false });

        if (lectureError) {
          throw lectureError;
        }

        setLectures((lectureData ?? []) as LectureRecord[]);
      } catch (error: any) {
        console.error("Unable to load playlist studio:", error);

        toast({
          title: t("scholars.playlists.create.openError", {
            defaultValue: "Unable to open playlist studio",
          }),
          description:
            error?.message ||
            t("scholars.playlists.create.tryAgain", {
              defaultValue: "Please try again.",
            }),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [scholarId, toast, user?.id, t]);

  const selectedCountLabel = useMemo(() => {
    return t("scholars.playlists.create.selectedCount", {
      count: selectedLectureIds.length,
      defaultValue:
        selectedLectureIds.length === 1
          ? "{{count}} lecture selected"
          : "{{count}} lectures selected",
    });
  }, [selectedLectureIds.length, t]);

  const toggleLecture = (lectureId: string) => {
    setSelectedLectureIds((current) =>
      current.includes(lectureId)
        ? current.filter((id) => id !== lectureId)
        : [...current, lectureId]
    );
  };

  const handleSubmit = async () => {
    if (!scholar || !user?.id || !scholarId) {
      toast({
        title: t("scholars.playlists.create.accessRequired", {
          defaultValue: "Scholar access required",
        }),
        description: t(
          "scholars.playlists.create.accessRequiredDescription",
          {
            defaultValue:
              "Only the approved scholar can create playlists.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    if (!title.trim()) {
      toast({
        title: t("scholars.playlists.create.titleRequired", {
          defaultValue: "Playlist title required",
        }),
        description: t(
          "scholars.playlists.create.titleRequiredDescription",
          {
            defaultValue: "Enter a title for the playlist.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    if (selectedLectureIds.length === 0) {
      toast({
        title: t("scholars.playlists.create.selectLecture", {
          defaultValue: "Select at least one lecture",
        }),
        description: t(
          "scholars.playlists.create.selectLectureDescription",
          {
            defaultValue:
              "A playlist must contain at least one approved lecture.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    try {
      setSubmitting(true);

      const firstSelectedLecture = lectures.find(
        (lecture) => lecture.id === selectedLectureIds[0]
      );

      const { data: playlistData, error: playlistError } =
        await supabase
          .from("scholar_playlists")
          .insert({
            scholar_id: scholarId,
            title: title.trim(),
            description: description.trim() || null,
            thumbnail_url:
              firstSelectedLecture?.thumbnail_url ?? null,
            is_published: isPublished,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

      if (playlistError) {
        throw playlistError;
      }

      const playlistItems = selectedLectureIds.map(
        (lectureId, index) => ({
          playlist_id: playlistData.id,
          lecture_id: lectureId,
          position: index + 1,
        })
      );

      const { error: itemsError } = await supabase
        .from("scholar_playlist_items")
        .insert(playlistItems);

      if (itemsError) {
        await supabase
          .from("scholar_playlists")
          .delete()
          .eq("id", playlistData.id);

        throw itemsError;
      }

      toast({
        title: isPublished
          ? t("scholars.playlists.create.published", {
              defaultValue: "Playlist published",
            })
          : t("scholars.playlists.create.savedDraft", {
              defaultValue: "Playlist saved as draft",
            }),
        description: t("scholars.playlists.create.createdDescription", {
          title: title.trim(),
          defaultValue: '"{{title}}" was created successfully.',
        }),
      });

      navigate(`/scholars/${scholarId}`);
    } catch (error: any) {
      console.error("Unable to create playlist:", error);

      toast({
        title: t("scholars.playlists.create.createError", {
          defaultValue: "Unable to create playlist",
        }),
        description:
          error?.message ||
          t("scholars.playlists.create.tryAgain", {
            defaultValue: "Please try again.",
          }),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />

          <span>
            {t("scholars.playlists.create.loading", {
              defaultValue: "Loading playlist studio...",
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
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />

            <h1 className="text-xl font-semibold">
              {t("scholars.playlists.create.unavailable", {
                defaultValue: "Playlist studio unavailable",
              })}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {t("scholars.playlists.create.unavailableDescription", {
                defaultValue:
                  "Only the approved owner of this scholar profile can create playlists.",
              })}
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
              {t("scholars.playlists.create.returnToScholar", {
                defaultValue: "Return to Scholar",
              })}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigate(`/scholars/${scholar.id}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />

            {t("back", {
              defaultValue: "Back",
            })}
          </Button>

          <Badge variant="secondary">
            {selectedCountLabel}
          </Badge>
        </div>

        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {t("scholars.playlists.create.title", {
              defaultValue: "Create Playlist",
            })}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {t("scholars.playlists.create.intro", {
              scholar: scholar.display_name,
              defaultValue:
                "Organize approved lectures from {{scholar}} into a series.",
            })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("scholars.playlists.create.details", {
                defaultValue: "Playlist Details",
              })}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="playlist-title">
                {t("scholars.playlists.create.titleLabel", {
                  defaultValue: "Title",
                })}
              </Label>

              <Input
                id="playlist-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder={t(
                  "scholars.playlists.create.titlePlaceholder",
                  {
                    defaultValue:
                      "Example: Tafsir of Surah Al-Baqarah",
                  }
                )}
                maxLength={150}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="playlist-description">
                {t("scholars.playlists.create.descriptionLabel", {
                  defaultValue: "Description",
                })}
              </Label>

              <Textarea
                id="playlist-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder={t(
                  "scholars.playlists.create.descriptionPlaceholder",
                  {
                    defaultValue:
                      "Describe this lecture series...",
                  }
                )}
                rows={5}
                maxLength={2000}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="playlist-published"
                checked={isPublished}
                onCheckedChange={(checked) =>
                  setIsPublished(checked === true)
                }
              />

              <div>
                <Label
                  htmlFor="playlist-published"
                  className="cursor-pointer"
                >
                  {t("scholars.playlists.create.publish", {
                    defaultValue: "Publish playlist",
                  })}
                </Label>

                <p className="mt-1 text-sm text-muted-foreground">
                  {t("scholars.playlists.create.publishDescription", {
                    defaultValue:
                      "Published playlists are visible to users. Unpublished playlists remain private drafts.",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                {t("scholars.playlists.create.selectLectures", {
                  defaultValue: "Select Lectures",
                })}
              </CardTitle>

              <Badge variant="outline">
                {t("scholars.playlists.create.approvedCount", {
                  count: lectures.length,
                  defaultValue: "{{count}} approved",
                })}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {lectures.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

                <h2 className="font-semibold">
                  {t("scholars.playlists.create.noLectures", {
                    defaultValue:
                      "No approved lectures available",
                  })}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  {t("scholars.playlists.create.noLecturesDescription", {
                    defaultValue:
                      "Upload and receive approval for lectures before creating a playlist.",
                  })}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {lectures.map((lecture) => {
                  const selected =
                    selectedLectureIds.includes(lecture.id);

                  return (
                    <button
                      key={lecture.id}
                      type="button"
                      className={[
                        "overflow-hidden rounded-xl border text-left transition",
                        selected
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:bg-muted/50",
                      ].join(" ")}
                      onClick={() =>
                        toggleLecture(lecture.id)
                      }
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
                            preload="auto"
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                            onLoadedMetadata={(event) => {
                              const video = event.currentTarget;

                              if (video.duration > 0) {
                                video.currentTime = Math.min(
                                  1,
                                  video.duration / 10
                                );
                              }
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}

                        <div
                          className={[
                            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border shadow",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background/90",
                          ].join(" ")}
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 p-4">
                        <h2 className="line-clamp-2 font-semibold">
                          {lecture.title}
                        </h2>

                        {lecture.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {lecture.description}
                          </p>
                        )}

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
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate(`/scholars/${scholar.id}`)
            }
            disabled={submitting}
          >
            {t("cancel", {
              defaultValue: "Cancel",
            })}
          </Button>

          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              !title.trim() ||
              selectedLectureIds.length === 0
            }
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}

            {isPublished
              ? t("scholars.playlists.create.createPublish", {
                  defaultValue: "Create and Publish",
                })
              : t("scholars.playlists.create.saveDraft", {
                  defaultValue: "Save Draft",
                })}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default CreateScholarPlaylist;