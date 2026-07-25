import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  Save,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type LectureRecord = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
};

type PlaylistItemRecord = {
  lecture_id: string;
  position: number;
};

const EditScholarPlaylist = () => {
  const navigate = useNavigate();
  const { scholarId, playlistId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const [lectures, setLectures] = useState<LectureRecord[]>([]);
  const [selectedLectureIds, setSelectedLectureIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPage = async () => {
      if (!scholarId || !playlistId || !user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: playlistData, error: playlistError } =
        await supabase
          .from("scholar_playlists")
          .select(`
            id,
            scholar_id,
            title,
            description,
            is_published
          `)
          .eq("id", playlistId)
          .eq("scholar_id", scholarId)
          .single();

      if (playlistError || !playlistData) {
        console.error("Failed to load playlist:", playlistError);

        toast({
          title: t("scholars.playlists.edit.notFound", {
            defaultValue: "Playlist not found",
          }),
          description:
            playlistError?.message ??
            t("scholars.playlists.edit.notFoundDescription", {
              defaultValue: "This playlist could not be loaded.",
            }),
          variant: "destructive",
        });

        setLoading(false);
        return;
      }

      setTitle(playlistData.title ?? "");
      setDescription(playlistData.description ?? "");
      setIsPublished(Boolean(playlistData.is_published));

      const { data: lectureData, error: lectureError } =
        await supabase
          .from("scholar_lectures")
          .select(`
            id,
            title,
            description,
            thumbnail_url,
            video_url
          `)
          .eq("scholar_id", scholarId)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

      if (lectureError) {
        console.error("Failed to load lectures:", lectureError);

        toast({
          title: t("scholars.playlists.edit.loadLecturesError", {
            defaultValue: "Unable to load lectures",
          }),
          description: lectureError.message,
          variant: "destructive",
        });

        setLoading(false);
        return;
      }

      setLectures((lectureData ?? []) as LectureRecord[]);

      const { data: itemData, error: itemError } =
        await supabase
          .from("scholar_playlist_items")
          .select(`
            lecture_id,
            position
          `)
          .eq("playlist_id", playlistId)
          .order("position", { ascending: true });

      if (itemError) {
        console.error("Failed to load playlist items:", itemError);

        toast({
          title: t("scholars.playlists.edit.loadItemsError", {
            defaultValue: "Unable to load playlist lectures",
          }),
          description: itemError.message,
          variant: "destructive",
        });

        setLoading(false);
        return;
      }

      const orderedIds = ((itemData ?? []) as PlaylistItemRecord[]).map(
        (item) => item.lecture_id
      );

      setSelectedLectureIds(orderedIds);
      setLoading(false);
    };

    void loadPage();
  }, [playlistId, scholarId, user?.id, t]);

  const selectedLectures = useMemo(() => {
    const lectureMap = new Map(
      lectures.map((lecture) => [lecture.id, lecture])
    );

    return selectedLectureIds
      .map((lectureId) => lectureMap.get(lectureId))
      .filter(Boolean) as LectureRecord[];
  }, [lectures, selectedLectureIds]);

  const toggleLecture = (lectureId: string) => {
    setSelectedLectureIds((current) => {
      if (current.includes(lectureId)) {
        return current.filter((id) => id !== lectureId);
      }

      return [...current, lectureId];
    });
  };

  const moveLecture = (
    lectureId: string,
    direction: "up" | "down"
  ) => {
    setSelectedLectureIds((current) => {
      const currentIndex = current.indexOf(lectureId);

      if (currentIndex === -1) return current;

      const targetIndex =
        direction === "up"
          ? currentIndex - 1
          : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];

      [next[currentIndex], next[targetIndex]] = [
        next[targetIndex],
        next[currentIndex],
      ];

      return next;
    });
  };

  const handleSave = async () => {
    if (!scholarId || !playlistId) return;

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast({
        title: t("scholars.playlists.edit.titleRequired", {
          defaultValue: "Title required",
        }),
        description: t(
          "scholars.playlists.edit.titleRequiredDescription",
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
        title: t("scholars.playlists.edit.selectLecture", {
          defaultValue: "Select at least one lecture",
        }),
        description: t(
          "scholars.playlists.edit.selectLectureDescription",
          {
            defaultValue:
              "A playlist must contain at least one lecture.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("scholar_playlists")
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playlistId)
      .eq("scholar_id", scholarId);

    if (updateError) {
      console.error("Failed to update playlist:", updateError);

      toast({
        title: t("scholars.playlists.edit.updateError", {
          defaultValue: "Unable to update playlist",
        }),
        description: updateError.message,
        variant: "destructive",
      });

      setSaving(false);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("scholar_playlist_items")
      .delete()
      .eq("playlist_id", playlistId);

    if (deleteItemsError) {
      console.error(
        "Failed to remove old playlist items:",
        deleteItemsError
      );

      toast({
        title: t("scholars.playlists.edit.updateItemsError", {
          defaultValue: "Unable to update playlist lectures",
        }),
        description: deleteItemsError.message,
        variant: "destructive",
      });

      setSaving(false);
      return;
    }

    const newItems = selectedLectureIds.map(
      (lectureId, index) => ({
        playlist_id: playlistId,
        lecture_id: lectureId,
        position: index + 1,
      })
    );

    const { error: insertItemsError } = await supabase
      .from("scholar_playlist_items")
      .insert(newItems);

    if (insertItemsError) {
      console.error(
        "Failed to save playlist items:",
        insertItemsError
      );

      toast({
        title: t("scholars.playlists.edit.saveItemsError", {
          defaultValue: "Unable to save playlist lectures",
        }),
        description: insertItemsError.message,
        variant: "destructive",
      });

      setSaving(false);
      return;
    }

    toast({
      title: t("scholars.playlists.edit.updated", {
        defaultValue: "Playlist updated",
      }),
      description: t("scholars.playlists.edit.updatedDescription", {
        defaultValue:
          "Your playlist changes were saved successfully.",
      }),
    });

    setSaving(false);
    navigate(`/scholars/${scholarId}/playlists`);
  };

  if (loading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">
          {t("scholars.playlists.loading", {
            defaultValue: "Loading playlist...",
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <Button
        type="button"
        variant="ghost"
        className="mb-4"
        onClick={() =>
          navigate(`/scholars/${scholarId}/playlists`)
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />

        {t("back", {
          defaultValue: "Back",
        })}
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {t("scholars.playlists.edit.title", {
            defaultValue: "Edit Playlist",
          })}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {t("scholars.playlists.edit.description", {
            defaultValue:
              "Update the playlist details, lectures, and order.",
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("scholars.playlists.edit.details", {
                  defaultValue: "Playlist Details",
                })}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="playlist-title">
                  {t("scholars.playlists.edit.playlistTitle", {
                    defaultValue: "Playlist title",
                  })}
                </Label>

                <Input
                  id="playlist-title"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder={t(
                    "scholars.playlists.edit.titlePlaceholder",
                    {
                      defaultValue: "Enter playlist title",
                    }
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playlist-description">
                  {t("scholars.playlists.edit.descriptionLabel", {
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
                    "scholars.playlists.edit.descriptionPlaceholder",
                    {
                      defaultValue: "Describe this lecture series",
                    }
                  )}
                  rows={5}
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="playlist-published"
                  checked={isPublished}
                  onCheckedChange={(checked) =>
                    setIsPublished(checked === true)
                  }
                />

                <Label htmlFor="playlist-published">
                  {t("scholars.playlists.edit.publishPlaylist", {
                    defaultValue: "Publish this playlist",
                  })}
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("scholars.playlists.edit.availableLectures", {
                  defaultValue: "Available Lectures",
                })}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {lectures.length === 0 ? (
                <div className="py-10 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />

                  <p className="mt-3 font-medium">
                    {t("scholars.playlists.edit.noLectures", {
                      defaultValue:
                        "No approved lectures available",
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
                            : "hover:border-primary/50",
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
                                const video =
                                  event.currentTarget;

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
                            ) : null}
                          </div>
                        </div>

                        <div className="p-4">
                          <h3 className="font-semibold">
                            {lecture.title}
                          </h3>

                          {lecture.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {lecture.description}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>
                {t("scholars.playlists.edit.order", {
                  count: selectedLectures.length,
                  defaultValue:
                    "Playlist Order ({{count}})",
                })}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {selectedLectures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("scholars.playlists.edit.orderEmpty", {
                    defaultValue:
                      "Select lectures to add them to this playlist.",
                  })}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedLectures.map((lecture, index) => (
                    <div
                      key={lecture.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {index + 1}
                      </span>

                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {lecture.title}
                      </p>

                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t(
                            "scholars.playlists.edit.moveUp",
                            {
                              defaultValue: "Move lecture up",
                            }
                          )}
                          disabled={index === 0}
                          onClick={() =>
                            moveLecture(lecture.id, "up")
                          }
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t(
                            "scholars.playlists.edit.moveDown",
                            {
                              defaultValue: "Move lecture down",
                            }
                          )}
                          disabled={
                            index === selectedLectures.length - 1
                          }
                          onClick={() =>
                            moveLecture(lecture.id, "down")
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                className="mt-6 w-full"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                <Save className="mr-2 h-4 w-4" />

                {saving
                  ? t("scholars.playlists.edit.saving", {
                      defaultValue: "Saving...",
                    })
                  : t("scholars.playlists.edit.save", {
                      defaultValue: "Save Changes",
                    })}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default EditScholarPlaylist;