import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  ListVideo,
  FileEdit,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type LectureStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

type ScholarRecord = {
  id: string;
  user_id: string;
  display_name: string;
  verification_status: string;
  is_active: boolean;
};

type ScholarLecture = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  is_featured: boolean;
  status: LectureStatus;
  created_at: string;
  updated_at?: string | null;
};

type FilterValue = "all" | LectureStatus;

const ScholarLectures = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [scholar, setScholar] = useState<ScholarRecord | null>(null);
  const [lectures, setLectures] = useState<ScholarLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<FilterValue>("all");
  const [updatingLectureId, setUpdatingLectureId] =
    useState<string | null>(null);
  const [deletingLectureId, setDeletingLectureId] =
    useState<string | null>(null);

  const loadLectures = useCallback(
    async (showRefreshIndicator = false) => {
      if (!scholarId || !user?.id) {
        setLoading(false);
        return;
      }

      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
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
            .maybeSingle();

        if (scholarError) {
          throw scholarError;
        }

        if (!scholarData) {
          setScholar(null);
          setLectures([]);
          return;
        }

        setScholar(scholarData as ScholarRecord);

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
                is_featured,
                status,
                created_at,
                updated_at
              `
            )
            .eq("scholar_id", scholarId)
            .order("created_at", { ascending: false });

        if (lectureError) {
          throw lectureError;
        }

        setLectures(
          (lectureData ?? []) as ScholarLecture[]
        );
      } catch (error: any) {
        console.error("Unable to load scholar lectures:", error);

toast({
  title: t("scholars.lectureManager.loadError", {
    defaultValue: "Unable to load lectures",
  }),
  description:
    error?.message ||
    t("scholars.lectureManager.loadErrorDescription", {
      defaultValue: "Your lectures could not be loaded.",
    }),
  variant: "destructive",
});
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scholarId, user?.id, toast, t]
  );

  useEffect(() => {
    void loadLectures();
  }, [loadLectures]);

  const lectureCounts = useMemo(() => {
    return {
      all: lectures.length,
      draft: lectures.filter(
        (lecture) => lecture.status === "draft"
      ).length,
      pending: lectures.filter(
        (lecture) => lecture.status === "pending"
      ).length,
      approved: lectures.filter(
        (lecture) => lecture.status === "approved"
      ).length,
      rejected: lectures.filter(
        (lecture) => lecture.status === "rejected"
      ).length,
      archived: lectures.filter(
        (lecture) => lecture.status === "archived"
      ).length,
    };
  }, [lectures]);

  const filteredLectures = useMemo(() => {
    if (activeFilter === "all") {
      return lectures;
    }

    return lectures.filter(
      (lecture) => lecture.status === activeFilter
    );
  }, [activeFilter, lectures]);

const getStatusBadge = (status: LectureStatus) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-600 hover:bg-green-600">
          {t("scholars.lectureManager.status.approved", {
            defaultValue: "Approved",
          })}
        </Badge>
      );

    case "pending":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500">
          {t("scholars.lectureManager.status.pending", {
            defaultValue: "Pending Review",
          })}
        </Badge>
      );

    case "rejected":
      return (
        <Badge variant="destructive">
          {t("scholars.lectureManager.status.rejected", {
            defaultValue: "Rejected",
          })}
        </Badge>
      );

    case "archived":
      return (
        <Badge variant="secondary">
          {t("scholars.lectureManager.status.archived", {
            defaultValue: "Archived",
          })}
        </Badge>
      );

    default:
      return (
        <Badge variant="outline">
          {t("scholars.lectureManager.status.draft", {
            defaultValue: "Draft",
          })}
        </Badge>
      );
  }
};
const getStatusLabel = (status: FilterValue) => {
  switch (status) {
    case "draft":
      return t("scholars.lectureManager.status.draft", {
        defaultValue: "Draft",
      });

    case "pending":
      return t("scholars.lectureManager.status.pendingShort", {
        defaultValue: "Pending",
      });

    case "approved":
      return t("scholars.lectureManager.status.approved", {
        defaultValue: "Approved",
      });

    case "rejected":
      return t("scholars.lectureManager.status.rejected", {
        defaultValue: "Rejected",
      });

    case "archived":
      return t("scholars.lectureManager.status.archived", {
        defaultValue: "Archived",
      });

    default:
      return "";
  }
};

  const submitForReview = async (lectureId: string) => {
    try {
      setUpdatingLectureId(lectureId);

      const { error } = await supabase
        .from("scholar_lectures")
        .update({
          status: "pending",
        })
        .eq("id", lectureId)
        .eq("scholar_id", scholarId);

      if (error) {
        throw error;
      }

      setLectures((current) =>
        current.map((lecture) =>
          lecture.id === lectureId
            ? {
                ...lecture,
                status: "pending",
              }
            : lecture
        )
      );

  toast({
    title: t("scholars.lectureManager.submitted", {
      defaultValue: "Lecture submitted",
    }),
    description: t(
      "scholars.lectureManager.submittedDescription",
      {
        defaultValue:
          "The lecture has been submitted for administrator review.",
      }
    ),
  });
    } catch (error: any) {
      console.error("Lecture submission failed:", error);

  toast({
    title: t("scholars.lectureManager.submitError", {
      defaultValue: "Submission failed",
    }),
    description:
      error?.message ||
      t("scholars.lectureManager.submitErrorDescription", {
        defaultValue: "The lecture could not be submitted.",
      }),
    variant: "destructive",
  });
    } finally {
      setUpdatingLectureId(null);
    }
  };

  const deleteLecture = async (lecture: ScholarLecture) => {
 const confirmed = window.confirm(
   t("scholars.lectureManager.deleteConfirm", {
     title: lecture.title,
     defaultValue:
       'Delete "{{title}}" permanently? This action cannot be undone.',
   })
 );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingLectureId(lecture.id);

      const { error } = await supabase
        .from("scholar_lectures")
        .delete()
        .eq("id", lecture.id)
        .eq("scholar_id", scholarId);

      if (error) {
        throw error;
      }

      setLectures((current) =>
        current.filter(
          (item) => item.id !== lecture.id
        )
      );

  toast({
    title: t("scholars.lectureManager.deleted", {
      defaultValue: "Lecture deleted",
    }),
    description: t("scholars.lectureManager.deletedDescription", {
      defaultValue: "The lecture was permanently deleted.",
    }),
  });
    } catch (error: any) {
      console.error("Lecture deletion failed:", error);

   toast({
     title: t("scholars.lectureManager.deleteError", {
       defaultValue: "Delete failed",
     }),
     description:
       error?.message ||
       t("scholars.lectureManager.deleteErrorDescription", {
         defaultValue: "The lecture could not be deleted.",
       }),
     variant: "destructive",
   });
    } finally {
      setDeletingLectureId(null);
    }
  };

  const formatDate = (value: string) => {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>
            {t("scholars.lectureManager.loading", {
              defaultValue: "Loading your lectures...",
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
        <CardContent className="flex flex-col items-center py-12 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />

          <h1 className="text-xl font-semibold">
            {t("scholars.lectureManager.accessRequired", {
              defaultValue: "Scholar access required",
            })}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "scholars.lectureManager.accessRequiredDescription",
              {
                defaultValue:
                  "You do not have permission to manage lectures for this scholar account.",
              }
            )}
          </p>

          <Button
            type="button"
            className="mt-6"
            onClick={() => navigate("/scholars")}
          >
            {t("scholars.lectureManager.returnToScholars", {
              defaultValue: "Return to Scholars",
            })}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

  const renderLectureCards = () => {
    if (filteredLectures.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />

 <p className="font-medium">
   {activeFilter === "all"
     ? t("scholars.lectureManager.noLectures", {
         defaultValue: "No lectures",
       })
     : t("scholars.lectureManager.noStatusLectures", {
         status: getStatusLabel(activeFilter),
         defaultValue: "No {{status}} lectures",
       })}
 </p>

 <p className="mt-1 text-sm text-muted-foreground">
   {activeFilter === "all"
     ? t("scholars.lectureManager.emptyDescription", {
         defaultValue:
           "Upload your first lecture to get started.",
       })
     : t("scholars.lectureManager.emptyStatusDescription", {
         defaultValue:
           "There are no lectures with this status.",
       })}
 </p>

          {activeFilter === "all" && (
            <Button
              type="button"
              className="mt-5"
              onClick={() =>
                navigate(
                  `/scholars/${scholar.id}/lectures/new`
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("scholars.lectureManager.addLecture", {
                defaultValue: "Add Lecture",
              })}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLectures.map((lecture) => {
          const canModify =
            lecture.status === "draft" ||
            lecture.status === "rejected";

          const isUpdating =
            updatingLectureId === lecture.id;

          const isDeleting =
            deletingLectureId === lecture.id;

          return (
            <Card
              key={lecture.id}
              className="overflow-hidden"
            >
              <div className="relative aspect-video bg-muted">
                {lecture.thumbnail_url ? (
                  <img
                    src={lecture.thumbnail_url}
                    alt={lecture.title}
                    className="h-full w-full object-cover"
                  />) : lecture.video_url ? (
                      <video
                        src={lecture.video_url}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}


                <div className="absolute left-3 top-3">
                  {getStatusBadge(lecture.status)}
                </div>
              </div>

              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="line-clamp-2 font-semibold">
                    {lecture.title}
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground">
              {t("scholars.lectureManager.createdDate", {
                date: formatDate(lecture.created_at),
                defaultValue: "Created {{date}}",
              })}
                  </p>
                </div>

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

                  {lecture.is_featured && (
                    <Badge>
                      {t("scholars.lectureManager.featured", {
                        defaultValue: "Featured",
                      })}
                    </Badge>
                  )}
                </div>

                {lecture.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {lecture.description}
                  </p>
                )}

                {lecture.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              {t("scholars.lectureManager.rejectedNotice", {
                defaultValue:
                  "This lecture was rejected. Edit it before resubmitting it for review.",
              })}
                  </div>
                )}

                {lecture.status === "pending" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  {t("scholars.lectureManager.pendingNotice", {
                    defaultValue:
                      "This lecture is awaiting administrator review.",
                  })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        lecture.video_url,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {t("scholars.lectureManager.preview", {
                      defaultValue: "Preview",
                    })}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canModify}
                    onClick={() =>
                      navigate(
                        `/scholars/${scholar.id}/lectures/${lecture.id}/edit`
                      )
                    }
                  >
                    <FileEdit className="mr-2 h-4 w-4" />
                    {t("scholars.lectureManager.edit", {
                      defaultValue: "Edit",
                    })}
                  </Button>
                </div>

                {canModify && (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isUpdating || isDeleting}
                    onClick={() =>
                      void submitForReview(lecture.id)
                    }
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}

                    {t("scholars.lectureManager.submitForReview", {
                      defaultValue: "Submit for Review",
                    })}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={isDeleting || isUpdating}
                  onClick={() => void deleteLecture(lecture)}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}

                  {t("scholars.lectureManager.delete", {
                    defaultValue: "Delete",
                  })}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigate(`/scholars/${scholar.id}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("scholars.lectureManager.scholarProfile", {
              defaultValue: "Scholar Profile",
            })}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void loadLectures(true)}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}

              {t("scholars.lectureManager.refresh", {
                defaultValue: "Refresh",
              })}
            </Button>

            <Button
              type="button"
              onClick={() =>
                navigate(
                  `/scholars/${scholar.id}/lectures/new`
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("scholars.lectureManager.addLecture", {
                defaultValue: "Add Lecture",
              })}
            </Button>
          </div>
        </div>

        <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {t("scholars.lectureManager.myLectures", {
                scholar: scholar.display_name,
                defaultValue: "{{scholar}} — My Lectures",
              })}
            </CardTitle>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(`/scholars/${scholar.id}/playlists`)
              }
            >
              <ListVideo className="mr-2 h-4 w-4" />
              {t("scholars.playlists.manage.title", {
                defaultValue: "Manage Playlists",
              })}
            </Button>
          </div>
        </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">
                  {lectureCounts.all}
                </p>
                <p className="text-sm text-muted-foreground">
                 {t("scholars.lectureManager.total", {
                   defaultValue: "Total",
                 })}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">
                  {lectureCounts.pending}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("scholars.lectureManager.status.pendingShort", {
                    defaultValue: "Pending",
                  })}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">
                  {lectureCounts.approved}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("scholars.lectureManager.status.approved", {
                    defaultValue: "Approved",
                  })}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">
                  {lectureCounts.rejected}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("scholars.lectureManager.status.rejected", {
                    defaultValue: "Rejected",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={activeFilter}
          onValueChange={(value) =>
            setActiveFilter(value as FilterValue)
          }
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="all">
              {t("scholars.lectureManager.filters.all", {
                count: lectureCounts.all,
                defaultValue: "All ({{count}})",
              })}
            </TabsTrigger>

            <TabsTrigger value="draft">
              {t("scholars.lectureManager.filters.drafts", {
                count: lectureCounts.draft,
                defaultValue: "Drafts ({{count}})",
              })}
            </TabsTrigger>

            <TabsTrigger value="pending">
              {t("scholars.lectureManager.filters.pending", {
                count: lectureCounts.pending,
                defaultValue: "Pending ({{count}})",
              })}
            </TabsTrigger>

            <TabsTrigger value="approved">
              {t("scholars.lectureManager.filters.approved", {
                count: lectureCounts.approved,
                defaultValue: "Approved ({{count}})",
              })}
            </TabsTrigger>

            <TabsTrigger value="rejected">
              {t("scholars.lectureManager.filters.rejected", {
                count: lectureCounts.rejected,
                defaultValue: "Rejected ({{count}})",
              })}
            </TabsTrigger>
          </TabsList>

          {[
            "all",
            "draft",
            "pending",
            "approved",
            "rejected",
          ].map((value) => (
            <TabsContent
              key={value}
              value={value}
              className="mt-6"
            >
              {renderLectureCards()}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      </main>
  );
};

export default ScholarLectures;