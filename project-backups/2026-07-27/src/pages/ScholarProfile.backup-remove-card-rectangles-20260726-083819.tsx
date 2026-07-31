import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Languages,
  MapPin,
  Play,
  Plus,
  Share2,
  Star,
  UserCheck,
  UserPlus,
  Youtube,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";


import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type ScholarProfileRecord = {
  id: string;
  user_id: string;
  display_name: string;
  biography: string | null;
  specialties: string[];
  languages: string[];
  country: string | null;
  city: string | null;
  website_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  verification_status: string;
  is_featured: boolean;
  is_active: boolean;
};

type UserProfileRecord = {
  avatar_url: string | null;
  username: string | null;
  full_name: string | null;
};

type ScholarDetails = ScholarProfileRecord & {
  avatar_url: string | null;
  username: string | null;
  full_name: string | null;
};

type ScholarLecture = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  is_featured: boolean;
  view_count: number;
  created_at: string;
};
type ScholarPlaylist = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string;
  lecture_count: number;
  first_lecture_thumbnail: string | null;
  first_lecture_video: string | null;
};


const ScholarProfile = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [scholar, setScholar] = useState<ScholarDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [lectures, setLectures] = useState<ScholarLecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(true);
  const [playlists, setPlaylists] = useState<ScholarPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);



  useEffect(() => {
    const loadScholar = async () => {
      if (!scholarId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setNotFound(false);

        const { data: scholarData, error: scholarError } = await supabase
          .from("scholar_profiles")
          .select(
            `
              id,
              user_id,
              display_name,
              biography,
              specialties,
              languages,
              country,
              city,
              website_url,
              youtube_url,
              facebook_url,
              instagram_url,
              verification_status,
              is_featured,
              is_active
            `
          )
          .eq("id", scholarId)
          .eq("verification_status", "approved")
          .eq("is_active", true)
          .maybeSingle();

        if (scholarError) {
          throw scholarError;
        }

        if (!scholarData) {
          setNotFound(true);
          setScholar(null);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_url, username, full_name")
          .eq("user_id", scholarData.user_id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const profile = profileData as UserProfileRecord | null;

        setScholar({
          ...(scholarData as ScholarProfileRecord),
          avatar_url: profile?.avatar_url ?? null,
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
        });
      } catch (error) {
        console.error("Error loading scholar profile:", error);

toast({
  title: t("scholars.profilePage.loadError", {
    defaultValue: "Unable to load scholar",
  }),
  description: t("scholars.profilePage.loadErrorDescription", {
    defaultValue:
      "The scholar profile could not be loaded. Please try again.",
  }),
  variant: "destructive",
});
      } finally {
        setLoading(false);
      }
    };

    void loadScholar();
 }, [scholarId, toast, t]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

useEffect(() => {
  const loadFollowInformation = async () => {
    if (!scholarId) {
      return;
    }

    try {
      const { count, error: countError } = await supabase
        .from("scholar_followers")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("scholar_id", scholarId);

      if (countError) {
        throw countError;
      }

      setFollowerCount(count ?? 0);

      if (!user?.id) {
        setIsFollowing(false);
        return;
      }

      const { data, error } = await supabase
        .from("scholar_followers")
        .select("id")
        .eq("scholar_id", scholarId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setIsFollowing(Boolean(data));
    } catch (error) {
      console.error(
        "Could not load scholar follow information:",
        error
      );
    }
  };

  void loadFollowInformation();
}, [scholarId, user?.id]);

useEffect(() => {
  const loadLectures = async () => {
    if (!scholarId) {
      setLectures([]);
      setLecturesLoading(false);
      return;
    }

    try {
      setLecturesLoading(true);

      const { data, error } = await supabase
        .from("scholar_lectures")
        .select(
          `
            id,
            title,
            description,
            video_url,
            thumbnail_url,
            category,
            language,
            is_featured,
            view_count,
            created_at
          `
        )
        .eq("scholar_id", scholarId)
        .eq("status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setLectures((data ?? []) as ScholarLecture[]);
    } catch (error) {
      console.error("Could not load scholar lectures:", error);
      setLectures([]);
    } finally {
      setLecturesLoading(false);
    }
  };

  void loadLectures();
}, [scholarId]);
useEffect(() => {
  const loadPlaylists = async () => {
    if (!scholarId) {
      setPlaylists([]);
      setPlaylistsLoading(false);
      return;
    }

    try {
      setPlaylistsLoading(true);

      let playlistQuery = supabase
        .from("scholar_playlists")
        .select(
          `
            id,
            scholar_id,
            title,
            description,
            thumbnail_url,
            is_published,
            created_at
          `
        )
        .eq("scholar_id", scholarId)
        .order("created_at", { ascending: false });

      // Visitors see only published playlists.
      // The scholar owner can also see private drafts.
      if (user?.id !== scholar?.user_id) {
        playlistQuery = playlistQuery.eq("is_published", true);
      }

      const { data: playlistData, error: playlistError } =
        await playlistQuery;

      if (playlistError) {
        throw playlistError;
      }

      const playlistRows = playlistData ?? [];

      if (playlistRows.length === 0) {
        setPlaylists([]);
        return;
      }

      const playlistIds = playlistRows.map(
        (playlist) => playlist.id
      );

      const { data: itemData, error: itemError } = await supabase
        .from("scholar_playlist_items")
        .select(
          `
            playlist_id,
            position,
            lecture_id,
            scholar_lectures (
              id,
              thumbnail_url,
              video_url
            )
          `
        )
        .in("playlist_id", playlistIds)
        .order("position", { ascending: true });

      if (itemError) {
        throw itemError;
      }

      const playlistDetails = playlistRows.map((playlist) => {
        const matchingItems = (itemData ?? []).filter(
          (item) => item.playlist_id === playlist.id
        );

        const firstItem = matchingItems[0];

        const firstLecture = Array.isArray(
          firstItem?.scholar_lectures
        )
          ? firstItem?.scholar_lectures[0]
          : firstItem?.scholar_lectures;

        return {
          ...playlist,
          lecture_count: matchingItems.length,
          first_lecture_thumbnail:
            firstLecture?.thumbnail_url ?? null,
          first_lecture_video:
            firstLecture?.video_url ?? null,
        };
      });

      setPlaylists(playlistDetails as ScholarPlaylist[]);
    } catch (error) {
      console.error("Could not load scholar playlists:", error);
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  void loadPlaylists();
}, [scholarId, scholar?.user_id, user?.id]);

const handleFollowScholar = async () => {
  if (!scholar) {
    return;
  }

  if (!user?.id) {
    navigate("/auth");
    return;
  }

  if (user.id === scholar.user_id) {
toast({
  title: t("scholars.profilePage.ownProfile", {
    defaultValue: "This is your scholar profile",
  }),
  description: t("scholars.profilePage.ownProfileDescription", {
    defaultValue: "You cannot follow your own scholar profile.",
  }),
});

    return;
  }

  if (followLoading) {
    return;
  }

  setFollowLoading(true);

  try {
    if (isFollowing) {
      const { error } = await supabase
        .from("scholar_followers")
        .delete()
        .eq("scholar_id", scholar.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setIsFollowing(false);
      setFollowerCount((current) => Math.max(0, current - 1));

 toast({
   title: t("scholars.profilePage.unfollowed", {
     defaultValue: "Scholar unfollowed",
   }),
   description: t("scholars.profilePage.unfollowedDescription", {
     scholar: scholar.display_name,
     defaultValue:
       "You are no longer following {{scholar}}.",
   }),
 });
    } else {
      const { error } = await supabase
        .from("scholar_followers")
        .insert({
          scholar_id: scholar.id,
          user_id: user.id,
        });

      if (error) {
        throw error;
      }

      setIsFollowing(true);
      setFollowerCount((current) => current + 1);

 toast({
   title: t("scholars.profilePage.unfollowed", {
     defaultValue: "Scholar unfollowed",
   }),
   description: t("scholars.profilePage.unfollowedDescription", {
     scholar: scholar.display_name,
     defaultValue:
       "You are no longer following {{scholar}}.",
   }),
 });
    }
  } catch (error) {
    console.error("Could not update scholar follow status:", error);
toast({
  title: t("scholars.profilePage.followError", {
    defaultValue: "Unable to update follow status",
  }),
  description: t("scholars.profilePage.followErrorDescription", {
    defaultValue:
      "Your follow status could not be changed. Please try again.",
  }),
  variant: "destructive",
});
  } finally {
    setFollowLoading(false);
  }
};

  const handleShare = async () => {
    if (!scholar) return;

    const shareUrl = window.location.href;
    const shareTitle = scholar.display_name;
    const shareText = t("scholars.profilePage.shareText", {
      scholar: scholar.display_name,
      defaultValue: "View {{scholar}} on Tariq Islam.",
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(shareUrl);

  toast({
    title: t("scholars.profilePage.linkCopied", {
      defaultValue: "Profile link copied",
    }),
    description: t("scholars.profilePage.linkCopiedDescription", {
      defaultValue: "The scholar profile link was copied.",
    }),
  });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("Could not share scholar profile:", error);

  toast({
    title: t("scholars.profilePage.shareError", {
      defaultValue: "Unable to share",
    }),
    description: t("scholars.profilePage.shareErrorDescription", {
      defaultValue: "The scholar profile could not be shared.",
    }),
    variant: "destructive",
  });
    }
  };

  const openExternalLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <p className="text-muted-foreground">
          {t("scholars.profilePage.loading", {
            defaultValue: "Loading scholar profile...",
          })}
        </p>
      </main>
    );
  }

  if (notFound || !scholar) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />

         <h1 className="text-xl font-semibold">
           {t("scholars.profilePage.notFound", {
             defaultValue: "Scholar not found",
           })}
         </h1>

         <p className="mt-2 text-sm text-muted-foreground">
           {t("scholars.profilePage.notFoundDescription", {
             defaultValue:
               "This scholar profile may be unavailable, inactive, or awaiting approval.",
           })}
         </p>

            <Button
              type="button"
              className="mt-6"
              onClick={() => navigate("/scholars")}
            >
              {t("scholars.profilePage.returnToScholars", {
                defaultValue: "Return to Scholars",
              })}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

 return (
   <main className="min-h-screen bg-background">
     <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
       <div className="flex items-center justify-between gap-3">
         <Button
           type="button"
           variant="ghost"
           onClick={() => navigate(-1)}
         >
           <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back", {
            defaultValue: "Back",
          })}
         </Button>

         <Button
           type="button"
           variant="outline"
           onClick={handleShare}
         >
           <Share2 className="mr-2 h-4 w-4" />
          {t("scholars.profilePage.share", {
            defaultValue: "Share",
          })}
         </Button>
       </div>

       <Card>
         <CardContent className="p-6 sm:p-8">
           <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
             <Avatar className="h-28 w-28">
               <AvatarImage
                 src={scholar.avatar_url ?? undefined}
                 alt={scholar.display_name}
               />

               <AvatarFallback className="text-2xl">
                 {getInitials(scholar.display_name)}
               </AvatarFallback>
             </Avatar>

             <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-center gap-2">
                 <h1 className="text-2xl font-bold sm:text-3xl">
                   {scholar.display_name}
                 </h1>

                 <BadgeCheck className="h-6 w-6 shrink-0 text-primary" />
               </div>

               {scholar.is_featured && (
                 <Badge className="mt-3">
                   <Star className="mr-1 h-3 w-3" />
                   {t("scholars.profilePage.featuredScholar", {
                     defaultValue: "Featured Scholar",
                   })}
                 </Badge>
               )}

               {(scholar.city || scholar.country) && (
                 <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                   <MapPin className="h-4 w-4 shrink-0" />

                   <span>
                     {[scholar.city, scholar.country]
                       .filter(Boolean)
                       .join(", ")}
                   </span>
                 </div>
               )}

               {scholar.username && (
                 <p className="mt-2 text-sm text-muted-foreground">
                   @{scholar.username}
                 </p>
               )}

               <div className="mt-5 flex flex-wrap items-center gap-3">
                 {user?.id !== scholar.user_id && (
                   <Button
                     type="button"
                     onClick={handleFollowScholar}
                     disabled={followLoading}
                     variant={isFollowing ? "outline" : "default"}
                   >
                     {isFollowing ? (
                       <UserCheck className="mr-2 h-4 w-4" />
                     ) : (
                       <UserPlus className="mr-2 h-4 w-4" />
                     )}
{followLoading
  ? t("scholars.profilePage.updating", {
      defaultValue: "Updating...",
    })
  : isFollowing
    ? t("scholars.profilePage.following", {
        defaultValue: "Following",
      })
    : t("scholars.profilePage.followScholar", {
        defaultValue: "Follow Scholar",
      })}

                   </Button>
                 )}

                 <p className="text-sm text-muted-foreground">
                   <span className="font-semibold text-foreground">
                     {followerCount}
                   </span>{" "}
                  {t("scholars.profilePage.followerCount", {
                    count: followerCount,
                    defaultValue:
                      followerCount === 1
                        ? "follower"
                        : "followers",
                  })}
                 </p>
               </div>
             </div>
           </div>
         </CardContent>
       </Card>

       <div className="grid gap-6 lg:grid-cols-3">
         <Card className="lg:col-span-2">
           <CardHeader>
             <CardTitle>
               {t("scholars.profilePage.biography", {
                 defaultValue: "Biography",
               })}
             </CardTitle>
           </CardHeader>

           <CardContent>
             <p className="whitespace-pre-wrap leading-7 text-muted-foreground">
              {scholar.biography ||
                t("scholars.profilePage.noBiography", {
                  defaultValue: "No biography provided.",
                })}
             </p>
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>
               {t("scholars.profilePage.profileLinks", {
                 defaultValue: "Profile Links",
               })}
             </CardTitle>
           </CardHeader>

           <CardContent className="space-y-3">
             {scholar.website_url && (
               <Button
                 type="button"
                 variant="outline"
                 className="w-full justify-start"
                 onClick={() =>
                   openExternalLink(scholar.website_url!)
                 }
               >
                 <Globe2 className="mr-2 h-4 w-4" />
                 Website
                 <ExternalLink className="ml-auto h-4 w-4" />
               </Button>
             )}

             {scholar.youtube_url && (
               <Button
                 type="button"
                 variant="outline"
                 className="w-full justify-start"
                 onClick={() =>
                   openExternalLink(scholar.youtube_url!)
                 }
               >
                 <Youtube className="mr-2 h-4 w-4" />
                 YouTube
                 <ExternalLink className="ml-auto h-4 w-4" />
               </Button>
             )}

             {scholar.facebook_url && (
               <Button
                 type="button"
                 variant="outline"
                 className="w-full justify-start"
                 onClick={() =>
                   openExternalLink(scholar.facebook_url!)
                 }
               >
                 <Facebook className="mr-2 h-4 w-4" />
                 Facebook
                 <ExternalLink className="ml-auto h-4 w-4" />
               </Button>
             )}

             {scholar.instagram_url && (
               <Button
                 type="button"
                 variant="outline"
                 className="w-full justify-start"
                 onClick={() =>
                   openExternalLink(scholar.instagram_url!)
                 }
               >
                 <Instagram className="mr-2 h-4 w-4" />
                 Instagram
                 <ExternalLink className="ml-auto h-4 w-4" />
               </Button>
             )}

             {!scholar.website_url &&
               !scholar.youtube_url &&
               !scholar.facebook_url &&
               !scholar.instagram_url && (
              <p className="text-sm text-muted-foreground">
                {t("scholars.profilePage.noExternalLinks", {
                  defaultValue: "No external links have been added.",
                })}
              </p>
               )}
           </CardContent>
         </Card>
       </div>

       <div className="grid gap-6 md:grid-cols-2">
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t("scholars.profilePage.specialties", {
              defaultValue: "Specialties",
            })}
             </CardTitle>
           </CardHeader>

           <CardContent>
             {scholar.specialties.length > 0 ? (
               <div className="flex flex-wrap gap-2">
                 {scholar.specialties.map((specialty) => (
                   <Badge
                     key={specialty}
                     variant="secondary"
                   >
                     {specialty}
                   </Badge>
                 ))}
               </div>
             ) : (
               <p className="text-sm text-muted-foreground">
                 {t("scholars.profilePage.noSpecialtiesAdded", {
                   defaultValue: "No specialties have been added.",
                 })}
               </p>
             )}
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Languages className="h-5 w-5" />
               {t("scholars.profilePage.languages", {
                 defaultValue: "Languages",
               })}
             </CardTitle>
           </CardHeader>

           <CardContent>
             {scholar.languages.length > 0 ? (
               <div className="flex flex-wrap gap-2">
                 {scholar.languages.map((language) => (
                   <Badge
                     key={language}
                     variant="outline"
                   >
                     {language}
                   </Badge>
                 ))}
               </div>
             ) : (
               <p className="text-sm text-muted-foreground">
                 {t("scholars.profilePage.noLanguagesAdded", {
                   defaultValue: "No languages have been added.",
                 })}
               </p>
             )}
           </CardContent>
         </Card>
       </div>

     <Tabs defaultValue="home" className="w-full">
       <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="home">
            {t("scholars.profilePage.home", {
              defaultValue: "Home",
            })}
          </TabsTrigger>

<TabsTrigger value="playlists">
           {t("scholars.playlists.title", {
             defaultValue: "Playlists",
           })}
         </TabsTrigger>
        <TabsTrigger value="about">
          {t("scholars.profilePage.about", {
            defaultValue: "About",
          })}
        </TabsTrigger>
       </TabsList>

       <TabsContent value="home" className="mt-6 space-y-6">
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {t("scholars.profilePage.featuredLectures", {
              defaultValue: "Featured Lectures",
            })}
             </CardTitle>
           </CardHeader>

           <CardContent>
             {lecturesLoading ? (
               <p className="text-sm text-muted-foreground">
                 {t("scholars.profilePage.loadingLectures", {
                   defaultValue: "Loading lectures...",
                 })}
               </p>
             ) : lectures.filter((lecture) => lecture.is_featured).length === 0 ? (
               <div className="py-8 text-center">
                 <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="font-medium">
        {t("scholars.profilePage.noFeaturedLectures", {
          defaultValue: "No featured lectures yet",
        })}
      </p>

      <p className="mt-1 text-sm text-muted-foreground">
        {t("scholars.profilePage.noFeaturedLecturesDescription", {
          defaultValue:
            "Featured lectures from this scholar will appear here.",
        })}
      </p>
               </div>
             ) : (
               <div className="grid gap-4 sm:grid-cols-2">
                 {lectures
                   .filter((lecture) => lecture.is_featured)
                   .map((lecture) => (
                     <Card key={lecture.id} className="overflow-hidden">
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
                       </div>

                       <CardContent className="space-y-2 p-4">
                         <h3 className="font-semibold">{lecture.title}</h3>

                         {lecture.description && (
                           <p className="line-clamp-2 text-sm text-muted-foreground">
                             {lecture.description}
                           </p>
                         )}

                         <Button
                           type="button"
                           className="w-full"
                           onClick={() =>
                             navigate(
                               `/scholars/${scholar.id}/lectures/${lecture.id}`
                             )
                           }
                         >
                           <Play className="mr-2 h-4 w-4" />
                           {t("scholars.profilePage.watchLecture", {
                             defaultValue: "Watch Lecture",
                           })}
                         </Button>
                       </CardContent>
                     </Card>
                   ))}
               </div>
             )}
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>
               {t("scholars.profilePage.latestLectures", {
                 defaultValue: "Latest Lectures",
               })}
             </CardTitle>
           </CardHeader>

           <CardContent>
             {lecturesLoading ? (
               <p className="text-sm text-muted-foreground">
                 Loading lectures...
               </p>
             ) : lectures.length === 0 ? (
               <div className="py-8 text-center">
                 <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
               <p className="font-medium">
                 {t("scholars.profilePage.noPublishedLectures", {
                   defaultValue: "No lectures published yet",
                 })}
               </p>

               <p className="mt-1 text-sm text-muted-foreground">
                 {t("scholars.profilePage.noPublishedLecturesDescription", {
                   defaultValue:
                     "Published lectures will appear on this channel.",
                 })}
               </p>
               </div>
             ) : (
               <div className="grid gap-4 sm:grid-cols-2">
                 {lectures.slice(0, 4).map((lecture) => (
                   <Card key={lecture.id} className="overflow-hidden">
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
                     </div>

                     <CardContent className="space-y-2 p-4">
                       <h3 className="font-semibold">{lecture.title}</h3>

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

                       <Button
                         type="button"
                         variant="outline"
                         className="w-full"
                        onClick={() =>
                          navigate(
                            `/scholars/${scholar.id}/lectures/${lecture.id}`
                          )
                        }
                       >
                         <Play className="mr-2 h-4 w-4" />
                         {t("scholars.profilePage.watch", {
                           defaultValue: "Watch",
                         })}
                       </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </CardContent>
         </Card>
       </TabsContent>

       <TabsContent value="lectures" className="mt-6">
         <Card>
           <CardHeader>
             <div className="flex items-center justify-between gap-4">



   {user?.id === scholar.user_id && (
     <div className="flex flex-wrap gap-2">
       <Button
         type="button"
         variant="outline"
         onClick={() =>
           navigate(`/scholars/${scholar.id}/lectures`)
         }
       >
         <BookOpen className="mr-2 h-4 w-4" />

         {t("scholars.profile.manageLectures", {
           defaultValue: "Manage Lectures",
         })}
       </Button>

       <Button
         type="button"
         variant="outline"
         className="border-amber-500 bg-amber-400 text-black hover:bg-amber-500 hover:text-black"
         onClick={() =>
           navigate(`/scholars/${scholar.id}/playlists/new`)
         }
       >
         <Plus className="mr-2 h-4 w-4" />

         {t("scholars.playlists.manage.create", {
           defaultValue: "Create Playlist",
         })}
       </Button>

       <Button
         type="button"
         onClick={() =>
           navigate(`/scholars/${scholar.id}/lectures/new`)
         }
       >
         <Plus className="mr-2 h-4 w-4" />

         {t("scholars.profile.addLecture", {
           defaultValue: "Add Lecture",
         })}
       </Button>
     </div>
   )}
             </div>
           </CardHeader>

           <CardContent>
             {lecturesLoading ? (
               <p className="text-sm text-muted-foreground">
                 Loading lectures...
               </p>
             ) : lectures.length === 0 ? (
               <div className="py-10 text-center">
                 <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
    <p className="font-medium">
      {t("scholars.profilePage.noLectures", {
        defaultValue: "No lectures yet",
      })}
    </p>

    <p className="mt-1 text-sm text-muted-foreground">
      {t("scholars.profilePage.noLecturesDescription", {
        defaultValue:
          "This scholar has not published any lectures.",
      })}
    </p>
               </div>
             ) : (
               <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 {lectures.map((lecture) => (
                   <Card key={lecture.id} className="overflow-hidden">
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
                     </div>

                     <CardContent className="space-y-3 p-4">
                       <h3 className="font-semibold">{lecture.title}</h3>

                       {lecture.description && (
                         <p className="line-clamp-2 text-sm text-muted-foreground">
                           {lecture.description}
                         </p>
                       )}

                       <Button
                         type="button"
                         className="w-full"
                         onClick={() =>
                           navigate(
                             `/scholars/${scholar.id}/lectures/${lecture.id}`
                           )
                         }
                       >
                         <Play className="mr-2 h-4 w-4" />
                         Watch Lecture
                       </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </CardContent>
         </Card>
       </TabsContent>

<TabsContent value="playlists" className="mt-6">
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          {t("scholars.playlists.title", {
            defaultValue: "Playlists",
          })}
        </CardTitle>

        {user?.id === scholar.user_id && (
          <Button
            type="button"
            className="border-amber-500 bg-amber-400 text-black hover:bg-amber-500 hover:text-black"
            onClick={() =>
              navigate(`/scholars/${scholar.id}/playlists/new`)
            }
          >
            <Plus className="mr-2 h-4 w-4" />

            {t("scholars.playlists.manage.create", {
              defaultValue: "Create Playlist",
            })}
          </Button>
        )}
      </div>
    </CardHeader>

    <CardContent>
      {playlistsLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("scholars.playlists.profile.loading", {
            defaultValue: "Loading playlists...",
          })}
        </p>
      ) : playlists.length === 0 ? (
        <div className="py-10 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />

          <p className="font-medium">
            {t("scholars.playlists.profile.emptyTitle", {
              defaultValue: "No playlists yet",
            })}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {t("scholars.playlists.profile.emptyDescription", {
              defaultValue: "Scholar playlists will appear here.",
            })}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className="overflow-hidden"
            >
              <div className="relative aspect-video bg-muted">
                {playlist.thumbnail_url ? (
                  <img
                    src={playlist.thumbnail_url}
                    alt={playlist.title}
                    className="h-full w-full object-cover"
                  />
                ) : playlist.first_lecture_thumbnail ? (
                  <img
                    src={playlist.first_lecture_thumbnail}
                    alt={playlist.title}
                    className="h-full w-full object-cover"
                  />
                ) : playlist.first_lecture_video ? (
                  <video
                    src={playlist.first_lecture_video}
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
                </div>

                <div className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow">
                  {t("scholars.playlists.lectureCount", {
                    count: playlist.lecture_count,
                    defaultValue:
                      playlist.lecture_count === 1
                        ? "{{count}} lecture"
                        : "{{count}} lectures",
                  })}
                </div>
              </div>

              <CardContent className="space-y-3 p-4">
                <h3 className="line-clamp-2 font-semibold">
                  {playlist.title}
                </h3>

                {playlist.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {playlist.description}
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={!playlist.is_published}
                  onClick={() =>
                    navigate(
                      `/scholar-playlists/${playlist.id}`
                    )
                  }
                >
                  <Play className="mr-2 h-4 w-4" />

                  {playlist.is_published
                    ? t("scholars.playlists.profile.open", {
                        defaultValue: "Open Playlist",
                      })
                    : t("scholars.playlists.profile.draftPlaylist", {
                        defaultValue: "Draft Playlist",
                      })}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
       <TabsContent value="about" className="mt-6">
         <Card>
           <CardHeader>
             <CardTitle>
               {t("scholars.profilePage.aboutScholar", {
                 defaultValue: "About This Scholar",
               })}
             </CardTitle>
           </CardHeader>

           <CardContent className="space-y-5">
             <div>
    <h3 className="mb-2 font-semibold">
      {t("scholars.profilePage.biography", {
        defaultValue: "Biography",
      })}
    </h3>
               <p className="whitespace-pre-line text-muted-foreground">
                 {scholar.biography ||
                   t("scholars.profilePage.noBiography", {
                     defaultValue: "No biography provided.",
                   })}
               </p>
             </div>

             <div>
       <h3 className="mb-2 font-semibold">
         {t("scholars.profilePage.specialties", {
           defaultValue: "Specialties",
         })}
       </h3>
               <div className="flex flex-wrap gap-2">
                 {scholar.specialties?.length ? (
                   scholar.specialties.map((specialty) => (
                     <Badge key={specialty} variant="secondary">
                       {specialty}
                     </Badge>
                   ))
                 ) : (
                   <p className="text-sm text-muted-foreground">
                     {t("scholars.profilePage.noSpecialtiesListed", {
                       defaultValue: "No specialties listed.",
                     })}
                   </p>
                 )}
               </div>
             </div>

             <div>
 <h3 className="mb-2 font-semibold">
   {t("scholars.profilePage.languages", {
     defaultValue: "Languages",
   })}
 </h3>
               <div className="flex flex-wrap gap-2">
                 {scholar.languages?.length ? (
                   scholar.languages.map((language) => (
                     <Badge key={language} variant="outline">
                       {language}
                     </Badge>
                   ))
                 ) : (
                   <p className="text-sm text-muted-foreground">
           {t("scholars.profilePage.noLanguagesListed", {
             defaultValue: "No languages listed.",
           })}
                   </p>
                 )}
               </div>
             </div>
           </CardContent>
         </Card>
       </TabsContent>
     </Tabs>
     </div>
   </main>
 );
 };

 export default ScholarProfile;