import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Play,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

type PlaylistRecord = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

type PlaylistLecture = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  position: number;
};

const ScholarPlaylistViewer = () => {
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const { t } = useTranslation();

  const [playlist, setPlaylist] =
    useState<PlaylistRecord | null>(null);

  const [lectures, setLectures] =
    useState<PlaylistLecture[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlaylist = async () => {
      if (!playlistId) {
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
          .single();

      if (playlistError || !playlistData) {
        console.error(
          "Failed to load playlist:",
          playlistError
        );

        setPlaylist(null);
        setLoading(false);
        return;
      }

      setPlaylist(playlistData as PlaylistRecord);

      const { data: itemData, error: itemError } =
        await supabase
          .from("scholar_playlist_items")
          .select(`
            position,
            lecture:scholar_lectures (
              id,
              title,
              description,
              thumbnail_url,
              video_url
            )
          `)
          .eq("playlist_id", playlistId)
          .order("position", { ascending: true });

      if (itemError) {
        console.error(
          "Failed to load playlist lectures:",
          itemError
        );

        setLectures([]);
        setLoading(false);
        return;
      }

      const normalizedLectures = (itemData ?? [])
        .map((item: any) => {
          const lecture = Array.isArray(item.lecture)
            ? item.lecture[0]
            : item.lecture;

          if (!lecture) return null;

          return {
            id: lecture.id,
            title: lecture.title,
            description: lecture.description,
            thumbnail_url: lecture.thumbnail_url,
            video_url: lecture.video_url,
            position: item.position,
          };
        })
        .filter(Boolean) as PlaylistLecture[];

      setLectures(normalizedLectures);
      setLoading(false);
    };

    loadPlaylist();
  }, [playlistId]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">
          {t("scholars.playlists.loading", {
            defaultValue: "Loading playlist...",
          })}
        </p>
      </main>
    );
  }

  if (!playlist) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">
          {t("scholars.playlists.notFound", {
            defaultValue: "Playlist not found",
          })}
        </h1>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back", {
            defaultValue: "Back",
          })}
        </Button>
      </main>
    );
  }

  const firstLecture = lectures[0];

  const openLecture = (lectureId: string) => {
    navigate(
      `/scholars/${playlist.scholar_id}/lectures/${lectureId}`
    );
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <Button
        type="button"
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("back", {
          defaultValue: "Back",
        })}
      </Button>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="aspect-video overflow-hidden rounded-xl bg-muted">
          {firstLecture?.thumbnail_url ? (
            <img
              src={firstLecture.thumbnail_url}
              alt={playlist.title}
              className="h-full w-full object-cover"
            />
          ) : firstLecture?.video_url ? (
            <video
              src={firstLecture.video_url}
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
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant={
                playlist.is_published
                  ? "default"
                  : "secondary"
              }
            >
           {playlist.is_published
             ? t("scholars.playlists.published", {
                 defaultValue: "Published",
               })
             : t("scholars.playlists.draft", {
                 defaultValue: "Draft",
               })}
            </Badge>

            <span className="text-sm text-muted-foreground">
             {t("scholars.playlists.lectureCount", {
               count: lectures.length,
               defaultValue:
                 lectures.length === 1
                   ? "{{count}} lecture"
                   : "{{count}} lectures",
             })}
            </span>
          </div>

          <h1 className="text-3xl font-bold">
            {playlist.title}
          </h1>

          {playlist.description ? (
            <p className="mt-3 text-muted-foreground">
              {playlist.description}
            </p>
          ) : null}

          {firstLecture ? (
            <Button
              type="button"
              className="mt-5"
              onClick={() =>
                openLecture(firstLecture.id)
              }
            >
              <Play className="mr-2 h-4 w-4" />
              {t("scholars.playlists.playAll", {
                defaultValue: "Play All",
              })}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">
         {t("scholars.playlists.lectures", {
           defaultValue: "Lectures",
         })}
        </h2>

        {lectures.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-semibold">
                {t("scholars.playlists.noLectures", {
                  defaultValue: "No lectures in this playlist",
                })}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {t("scholars.playlists.noLecturesDescription", {
                  defaultValue: "The scholar has not added any lectures yet.",
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {lectures.map((lecture, index) => (
              <Card
                key={lecture.id}
                className="overflow-hidden"
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full flex-col text-left sm:flex-row"
                    onClick={() =>
                      openLecture(lecture.id)
                    }
                  >
                    <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted sm:w-48">
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
                              video.currentTime =
                                Math.min(
                                  1,
                                  video.duration / 10
                                );
                            }
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-9 w-9 text-muted-foreground" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white">
                          <Play className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 gap-3 p-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {index + 1}
                      </span>

                      <div>
                        <h3 className="font-semibold">
                          {lecture.title}
                        </h3>

                        {lecture.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {lecture.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default ScholarPlaylistViewer;