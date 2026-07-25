import { useEffect, useState } from "react";
import { ArrowLeft, Edit, Eye, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type PlaylistRecord = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_at: string;
  item_count?: number;
};

const ManageScholarPlaylists = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlaylists = async () => {
      if (!scholarId) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("scholar_playlists")
        .select(`
          id,
          scholar_id,
          title,
          description,
          is_published,
          created_at
        `)
        .eq("scholar_id", scholarId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load playlists:", error);
        setPlaylists([]);
        setLoading(false);
        return;
      }

      const basePlaylists = (data ?? []) as PlaylistRecord[];

      const playlistsWithCounts = await Promise.all(
        basePlaylists.map(async (playlist) => {
          const { count } = await supabase
            .from("scholar_playlist_items")
            .select("id", { count: "exact", head: true })
            .eq("playlist_id", playlist.id);

          return {
            ...playlist,
            item_count: count ?? 0,
          };
        })
      );

      setPlaylists(playlistsWithCounts);
      setLoading(false);
    };

    void loadPlaylists();
  }, [scholarId]);

  const handleDelete = async (playlistId: string) => {
    const confirmed = window.confirm(
      t("scholars.playlists.manage.deleteConfirm", {
        defaultValue: "Are you sure you want to delete this playlist?",
      })
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("scholar_playlists")
      .delete()
      .eq("id", playlistId);

    if (error) {
      console.error("Failed to delete playlist:", error);

      toast({
        title: t("scholars.playlists.manage.deleteError", {
          defaultValue: "Unable to delete playlist",
        }),
        description: error.message,
        variant: "destructive",
      });

      return;
    }

    setPlaylists((current) =>
      current.filter((playlist) => playlist.id !== playlistId)
    );

    toast({
      title: t("scholars.playlists.manage.deleted", {
        defaultValue: "Playlist deleted",
      }),
      description: t("scholars.playlists.manage.deletedDescription", {
        defaultValue: "The playlist has been removed.",
      }),
    });
  };

  const handleTogglePublished = async (playlist: PlaylistRecord) => {
    const nextPublishedState = !playlist.is_published;

    const { error } = await supabase
      .from("scholar_playlists")
      .update({
        is_published: nextPublishedState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playlist.id)
      .eq("scholar_id", scholarId);

    if (error) {
      console.error("Failed to update playlist:", error);

      toast({
        title: t("scholars.playlists.manage.updateError", {
          defaultValue: "Unable to update playlist",
        }),
        description: error.message,
        variant: "destructive",
      });

      return;
    }

    setPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? {
              ...item,
              is_published: nextPublishedState,
            }
          : item
      )
    );

    toast({
      title: nextPublishedState
        ? t("scholars.playlists.manage.publishedToast", {
            defaultValue: "Playlist published",
          })
        : t("scholars.playlists.manage.unpublishedToast", {
            defaultValue: "Playlist unpublished",
          }),
      description: nextPublishedState
        ? t("scholars.playlists.manage.publishedDescription", {
            defaultValue: "The playlist is now visible to users.",
          })
        : t("scholars.playlists.manage.unpublishedDescription", {
            defaultValue: "The playlist is now saved as a draft.",
          }),
    });
  };

  if (!scholarId) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p>
          {t("scholars.notFound", {
            defaultValue: "Scholar not found.",
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("back", {
              defaultValue: "Back",
            })}
            onClick={() =>
              navigate(`/scholars/${scholarId}/lectures`)
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold">
              {t("scholars.playlists.manage.title", {
                defaultValue: "Manage Playlists",
              })}
            </h1>

            <p className="text-sm text-muted-foreground">
              {t("scholars.playlists.manage.description", {
                defaultValue:
                  "Create, edit, publish, and organize your lecture playlists.",
              })}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() =>
            navigate(`/scholars/${scholarId}/playlists/new`)
          }
        >
          <Plus className="mr-2 h-4 w-4" />

          {t("scholars.playlists.manage.create", {
            defaultValue: "Create Playlist",
          })}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">
          {t("scholars.playlists.manage.loading", {
            defaultValue: "Loading playlists...",
          })}
        </p>
      ) : playlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <h2 className="text-lg font-semibold">
              {t("scholars.playlists.manage.emptyTitle", {
                defaultValue: "No playlists yet",
              })}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {t("scholars.playlists.manage.emptyDescription", {
                defaultValue:
                  "Create your first playlist and organize your lectures into a series.",
              })}
            </p>

            <Button
              type="button"
              className="mt-4"
              onClick={() =>
                navigate(`/scholars/${scholarId}/playlists/new`)
              }
            >
              <Plus className="mr-2 h-4 w-4" />

              {t("scholars.playlists.manage.create", {
                defaultValue: "Create Playlist",
              })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {playlists.map((playlist) => {
            const lectureCount = playlist.item_count ?? 0;

            return (
              <Card key={playlist.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{playlist.title}</CardTitle>

                      {playlist.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {playlist.description}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
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
                            count: lectureCount,
                            defaultValue:
                              lectureCount === 1
                                ? "{{count}} lecture"
                                : "{{count}} lectures",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/scholar-playlists/${playlist.id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />

                        {t("scholars.playlists.manage.open", {
                          defaultValue: "Open",
                        })}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/scholars/${scholarId}/playlists/${playlist.id}/edit`
                          )
                        }
                      >
                        <Edit className="mr-2 h-4 w-4" />

                        {t("scholars.playlists.manage.edit", {
                          defaultValue: "Edit",
                        })}
                      </Button>

                      <Button
                        type="button"
                        variant={
                          playlist.is_published
                            ? "secondary"
                            : "default"
                        }
                        size="sm"
                        onClick={() =>
                          void handleTogglePublished(playlist)
                        }
                      >
                        {playlist.is_published
                          ? t("scholars.playlists.manage.unpublish", {
                              defaultValue: "Unpublish",
                            })
                          : t("scholars.playlists.manage.publish", {
                              defaultValue: "Publish",
                            })}
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          void handleDelete(playlist.id)
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />

                        {t("scholars.playlists.manage.delete", {
                          defaultValue: "Delete",
                        })}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default ManageScholarPlaylists;