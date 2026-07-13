import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Heart, Play } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type CreatorProfileRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_creator_verified: boolean;
};

type CreatorVideo = {
  id: string;
  title: string;
  caption: string | null;
  category: string;
  language: string;
  video_url: string;
  created_at: string;
};

type FollowStatus = "none" | "pending" | "following";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function CreatorProfile() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { t } = useTranslation("common");

  const creatorRouteValue = useMemo(
    () => decodeURIComponent(userId ?? "").replace(/^@/, "").trim(),
    [userId]
  );

  const [creatorId, setCreatorId] = useState("");
  const [profile, setProfile] = useState<CreatorProfileRow | null>(null);
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] =
    useState<FollowStatus>("none");
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [editingVideo, setEditingVideo] = useState<CreatorVideo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
 const [savingEdit, setSavingEdit] = useState(false);


  const isOwnProfile = !!user?.id && user.id === creatorId;

  useEffect(() => {
    let alive = true;

    const loadCreator = async () => {
      if (!creatorRouteValue) {
        setProfile(null);
        setVideos([]);
        setCreatorId("");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        let profileQuery = supabase
          .from("profiles")
     .select(
       "user_id,full_name,username,avatar_url,bio,location,is_creator_verified"
     );

        profileQuery = UUID_PATTERN.test(creatorRouteValue)
          ? profileQuery.eq("user_id", creatorRouteValue)
          : profileQuery.eq("username", creatorRouteValue);

        const { data: profileRow, error: profileError } =
          await profileQuery.maybeSingle();

        if (profileError) throw profileError;

        if (!profileRow) {
          if (alive) {
            setProfile(null);
            setVideos([]);
            setCreatorId("");
            setFollowersCount(0);
            setFollowingCount(0);
            setTotalLikes(0);
            setFollowStatus("none");
          }
          return;
        }

        const resolvedCreatorId = profileRow.user_id;

        const [
          { data: videoRows, error: videosError },
          { data: connections, error: connectionsError },
        ] = await Promise.all([
          supabase
            .from("reflection_videos")
            .select(
              "id,title,caption,category,language,video_url,created_at"
            )
            .eq("user_id", resolvedCreatorId)
            .eq("status", "approved")
            .order("created_at", { ascending: false }),

          supabase
            .from("user_connections")
            .select("requester_id,receiver_id,status")
            .or(
              `requester_id.eq.${resolvedCreatorId},receiver_id.eq.${resolvedCreatorId}`
            ),
        ]);

        if (videosError) throw videosError;
        if (connectionsError) throw connectionsError;
        if (!alive) return;

        const loadedVideos = videoRows ?? [];
        const loadedConnections = connections ?? [];

        setCreatorId(resolvedCreatorId);
        setProfile(profileRow);
        setVideos(loadedVideos);

        const acceptedConnections = loadedConnections.filter(
          (row) => row.status === "accepted"
        );

        setFollowersCount(
          acceptedConnections.filter(
            (row) => row.receiver_id === resolvedCreatorId
          ).length
        );

        setFollowingCount(
          acceptedConnections.filter(
            (row) => row.requester_id === resolvedCreatorId
          ).length
        );

        if (user?.id && user.id !== resolvedCreatorId) {
          const currentConnection = loadedConnections.find(
            (row) =>
              row.requester_id === user.id &&
              row.receiver_id === resolvedCreatorId
          );

          if (currentConnection?.status === "accepted") {
            setFollowStatus("following");
          } else if (currentConnection?.status === "pending") {
            setFollowStatus("pending");
          } else {
            setFollowStatus("none");
          }
        } else {
          setFollowStatus("none");
        }

        const videoIds = loadedVideos.map((video) => video.id);

        if (videoIds.length === 0) {
          setTotalLikes(0);
          return;
        }

        const { count, error: likesError } = await supabase
          .from("reflection_likes")
          .select("*", { count: "exact", head: true })
          .in("reflection_id", videoIds);

        if (likesError) throw likesError;
        if (alive) setTotalLikes(count ?? 0);
      } catch (error) {
        console.error("Failed to load creator profile:", error);

        if (alive) {
          setProfile(null);
          setVideos([]);
          setCreatorId("");
          setFollowersCount(0);
          setFollowingCount(0);
          setTotalLikes(0);
          setFollowStatus("none");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadCreator();

    return () => {
      alive = false;
    };
  }, [creatorRouteValue, user?.id]);

  const handleFollow = async () => {
    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (!creatorId || isOwnProfile) return;

    if (followStatus === "following") {
      const confirmed = window.confirm(
        t("creatorProfile.unfollowConfirm", {
          defaultValue: "Unfollow this creator?",
        })
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("user_connections")
        .delete()
        .eq("requester_id", user.id)
        .eq("receiver_id", creatorId);

      if (error) {
        console.error("Failed to unfollow creator:", error);
        return;
      }

      setFollowStatus("none");
      setFollowersCount((previous) => Math.max(0, previous - 1));
      return;
    }

    if (followStatus === "pending") return;

    const { error } = await supabase
      .from("user_connections")
      .insert({
        requester_id: user.id,
        receiver_id: creatorId,
        status: "pending",
      });

    if (error) {
      if (error.code !== "23505") {
        console.error("Failed to follow creator:", error);
      }
      return;
    }

    setFollowStatus("pending");
  };
const handleStartEdit = (video: CreatorVideo) => {
  setEditingVideo(video);
  setEditTitle(video.title);
  setEditCaption(video.caption ?? "");
  setEditCategory(video.category);
  setEditLanguage(video.language);
};

const handleCancelEdit = () => {
  setEditingVideo(null);
  setEditTitle("");
  setEditCaption("");
  setEditCategory("");
  setEditLanguage("");
};

const handleSaveEdit = async () => {
  if (!user?.id || !editingVideo) return;

  const cleanTitle = editTitle.trim();
  const cleanCaption = editCaption.trim();

  if (!cleanTitle) return;

  setSavingEdit(true);

  try {
    const { error } = await supabase
      .from("reflection_videos")
      .update({
        title: cleanTitle,
        caption: cleanCaption || null,
        category: editCategory,
        language: editLanguage,
      })
      .eq("id", editingVideo.id)
      .eq("user_id", user.id);

    if (error) throw error;

    setVideos((current) =>
      current.map((video) =>
        video.id === editingVideo.id
          ? {
              ...video,
              title: cleanTitle,
              caption: cleanCaption || null,
              category: editCategory,
              language: editLanguage,
            }
          : video
      )
    );

    handleCancelEdit();
  } catch (error) {
    console.error("Failed to edit reflection:", error);
  } finally {
    setSavingEdit(false);
  }
};

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        {t("creatorProfile.loading", {
          defaultValue: "Loading creator profile...",
        })}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("callsPage.back")}
        </button>

        <p>
          {t("creatorProfile.notFound", {
            defaultValue: "Creator profile not found.",
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <div className="sticky top-0 z-20 flex items-center border-b bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("callsPage.back")}
        </button>
      </div>

      <section className="px-4 py-6">
        <div className="flex flex-col items-center text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || profile.username || ""}
              className="h-24 w-24 rounded-full border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-islamic-green text-3xl font-bold text-white">
              {(profile.full_name || profile.username || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

     <div className="mt-4 flex items-center justify-center gap-1.5">
       <h1 className="text-2xl font-bold">
         {profile.full_name ||
           profile.username ||
           t("reflections.tariqIslamUser")}
       </h1>

       {profile.is_creator_verified && (
         <BadgeCheck
           className="h-5 w-5 text-blue-500"
           aria-label={t("creatorProfile.verifiedCreator", {
             defaultValue: "Verified creator",
           })}
         />
       )}
     </div>

          {profile.username && (
            <p className="text-sm text-muted-foreground">
              @{profile.username}
            </p>
          )}

          {profile.location && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.location}
            </p>
          )}

          {profile.bio && (
            <p className="mt-3 max-w-md text-sm">{profile.bio}</p>
          )}

          {!isOwnProfile && (
            <Button
              type="button"
              onClick={() => void handleFollow()}
              className="mt-4 min-w-36"
              variant={
                followStatus === "following" ? "outline" : "default"
              }
            >
              {followStatus === "following"
                ? t("creatorProfile.following", {
                    defaultValue: "Following",
                  })
                : followStatus === "pending"
                  ? t("creatorProfile.requested", {
                      defaultValue: "Requested",
                    })
                  : t("creatorProfile.follow", {
                      defaultValue: "Follow",
                    })}
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          <div className="rounded-xl border p-3 text-center">
            <div className="text-lg font-bold">{videos.length}</div>
            <div className="text-xs text-muted-foreground">
              {t("creatorProfile.reflections", {
                defaultValue: "Reflections",
              })}
            </div>
          </div>

          <div className="rounded-xl border p-3 text-center">
            <div className="text-lg font-bold">{followersCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("creatorProfile.followers", {
                defaultValue: "Followers",
              })}
            </div>
          </div>

          <div className="rounded-xl border p-3 text-center">
            <div className="text-lg font-bold">{followingCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("creatorProfile.followingCount", {
                defaultValue: "Following",
              })}
            </div>
          </div>

          <div className="rounded-xl border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold">
              <Heart className="h-4 w-4" />
              {totalLikes}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("creatorProfile.likes", {
                defaultValue: "Likes",
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t px-2 py-4">
        {videos.length === 0 ? (
          <p className="px-4 text-center text-sm text-muted-foreground">
            {t("creatorProfile.noReflections", {
              defaultValue: "No reflections yet.",
            })}
          </p>
        ) : (
    <div className="grid grid-cols-3 gap-1">
      {videos.map((video) => (
        <div
          key={video.id}
          className="relative aspect-[3/4] overflow-hidden bg-black"
        >
          <button
            type="button"
            onClick={() => navigate(`/reflections?video=${video.id}`)}
            className="group h-full w-full"
          >
            <video
              src={video.video_url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
              <Play className="h-8 w-8 fill-white text-white" />
            </div>
          </button>

           {isOwnProfile && (
             <button
               type="button"
               onClick={(event) => {
                 event.stopPropagation();
                 handleStartEdit(video);
               }}
               className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white"
             >
               {t("creatorProfile.edit", {
                 defaultValue: "Edit",
               })}
             </button>
           )}
         </div>
       ))}
     </div>
   )}
 </section>

 {editingVideo && (
   <div className="fixed inset-0 z-[9999] flex items-end bg-black/70 sm:items-center sm:justify-center">
     <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 sm:max-w-lg sm:rounded-3xl">
       <h2 className="mb-4 text-xl font-bold">
         {t("creatorProfile.editReflection", {
           defaultValue: "Edit Reflection",
         })}
       </h2>

       <div className="space-y-4">
         <div>
           <label className="mb-1 block text-sm font-medium">
             {t("creatorProfile.title", {
               defaultValue: "Title",
             })}
           </label>

           <input
             value={editTitle}
             onChange={(event) => setEditTitle(event.target.value)}
             className="w-full rounded-lg border bg-background px-3 py-2"
           />
         </div>

         <div>
           <label className="mb-1 block text-sm font-medium">
             {t("creatorProfile.caption", {
               defaultValue: "Caption",
             })}
           </label>

           <textarea
             value={editCaption}
             onChange={(event) => setEditCaption(event.target.value)}
             className="min-h-[120px] w-full rounded-lg border bg-background px-3 py-2"
           />
         </div>

         <div>
           <label className="mb-1 block text-sm font-medium">
             {t("creatorProfile.category", {
               defaultValue: "Category",
             })}
           </label>

           <input
             value={editCategory}
             onChange={(event) => setEditCategory(event.target.value)}
             className="w-full rounded-lg border bg-background px-3 py-2"
           />
         </div>

         <div>
           <label className="mb-1 block text-sm font-medium">
             {t("creatorProfile.language", {
               defaultValue: "Language",
             })}
           </label>

           <input
             value={editLanguage}
             onChange={(event) => setEditLanguage(event.target.value)}
             className="w-full rounded-lg border bg-background px-3 py-2"
           />
         </div>

         <div className="flex gap-3">
           <Button
             type="button"
             onClick={() => void handleSaveEdit()}
             disabled={savingEdit || !editTitle.trim()}
             className="flex-1"
           >
          {savingEdit
            ? t("creatorProfile.saving", {
                defaultValue: "Saving...",
              })
            : t("creatorProfile.save", {
                defaultValue: "Save",
              })}
           </Button>

           <Button
             type="button"
             variant="outline"
             onClick={handleCancelEdit}
             disabled={savingEdit}
             className="flex-1"
           >
             {t("creatorProfile.cancel", {
               defaultValue: "Cancel",
             })}
           </Button>
         </div>
       </div>
     </div>
   </div>
 )}

 </main>
 );
 }