import { useEffect, useRef, useState } from "react";
import { PlayCircle, Upload, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type CaptionSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

type CaptionTranslation = {
  language_code: string;
  language_name: string;
  translated_segments: CaptionSegment[] | null;
};

type ReflectionVideo = {
  id: string;
  user_id: string;
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
  created_at: string;
  captions_text: string | null;
  captions_enabled: boolean;
  captions_language: string | null;
  captions_segments: CaptionSegment[] | null;
  creator_profile: {
    user_id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_creator_verified: boolean | null;
  } | null;
};

export default function FeaturedReflection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [videos, setVideos] = useState<ReflectionVideo[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<ReflectionVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [captionTranslations, setCaptionTranslations] =
    useState<Record<string, CaptionTranslation[]>>({});
const [featuredIndex, setFeaturedIndex] = useState(0);
const swipeStartXRef = useRef<number | null>(null);
const swipeStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("reflection_videos")
.select(
  "id,user_id,title,caption,category,language,video_url,thumbnail_url,trim_start_seconds,trim_end_seconds,reference_type,quran_surah_number,quran_ayah_start,quran_ayah_end,hadith_collection,hadith_number,reference_note,created_at,captions_text,captions_enabled,captions_language,captions_segments"
)
        .eq("status", "approved")
        .order("created_at", { ascending: false })


      if (!error && data) {
        const videoRows = data;
        const videoIds = videoRows.map((video) => video.id);
        const creatorIds = Array.from(
          new Set(
            videoRows
              .map((video) => video.user_id)
              .filter((userId): userId is string =>
                Boolean(userId)
              )
          )
        );

        const [
          { data: creatorProfiles },
          { data: translations },
        ] = await Promise.all([
          creatorIds.length > 0
            ? supabase
                .from("profiles")
                .select(
                  "user_id,full_name,username,avatar_url,is_creator_verified"
                )
                .in("user_id", creatorIds)
            : Promise.resolve({ data: [] }),
          videoIds.length > 0
            ? supabase
                .from("reflection_caption_translations")
                .select(
                  "reflection_id,language_code,language_name,translated_segments"
                )
                .in("reflection_id", videoIds)
            : Promise.resolve({ data: [] }),
        ]);

        const profilesByUserId = new Map(
          (creatorProfiles ?? []).map((profile) => [
            profile.user_id,
            profile,
          ])
        );

        const translationsByVideoId: Record<
          string,
          CaptionTranslation[]
        > = {};

        videoIds.forEach((id) => {
          translationsByVideoId[id] = [];
        });

        (translations ?? []).forEach((row) => {
          translationsByVideoId[row.reflection_id].push({
            language_code: row.language_code,
            language_name: row.language_name,
            translated_segments: Array.isArray(
              row.translated_segments
            )
              ? (row.translated_segments as CaptionSegment[])
              : null,
          });
        });

        setCaptionTranslations(translationsByVideoId);

        setVideos(
          videoRows.map((video) => ({
            ...video,
            creator_profile:
              profilesByUserId.get(video.user_id) ?? null,
          })) as ReflectionVideo[]
        );
      }

      setLoading(false);
    };

    void loadVideos();
  }, []);

  const featured = videos[featuredIndex];
  const playNextFeaturedVideo = () => {
    if (videos.length === 0) return;

    setFeaturedIndex((currentIndex) =>
      currentIndex < videos.length - 1 ? currentIndex + 1 : 0
    );
  };

  const playNextSelectedVideo = () => {
    if (!selectedVideo || videos.length === 0) return;

    const currentIndex = videos.findIndex(
      (video) => video.id === selectedVideo.id
    );

    const nextIndex =
      currentIndex >= 0 && currentIndex < videos.length - 1
        ? currentIndex + 1
        : 0;

    setSelectedVideo(videos[nextIndex]);
  };
const getCategoryLabel = (category: string) => {
  const normalized = category.trim().toLowerCase();

  const categoryKeys: Record<string, string> = {
    lecture: "reflections.categories.lecture",
    "daily reminder": "reflections.categories.dailyReminder",
    quran: "reflections.categories.quran",
    hadith: "reflections.categories.hadith",
    prayer: "reflections.categories.prayer",
    recitation: "reflections.categories.recitation",
  };

  const translationKey = categoryKeys[normalized];

  return translationKey
    ? t(translationKey, { defaultValue: category })
    : category;
};

const getLanguageLabel = (language: string) => {
  const normalized = language.trim().toLowerCase();

  const languageKeys: Record<string, string> = {
    english: "reflections.languages.english",
    arabic: "reflections.languages.arabic",
    french: "reflections.languages.french",
    hausa: "reflections.languages.hausa",
    yoruba: "reflections.languages.yoruba",
  };

  const translationKey = languageKeys[normalized];

  return translationKey
    ? t(translationKey, { defaultValue: language })
    : language;
};
const getTopicLabel = (title: string) => {
  const normalized = title.trim().toLowerCase();

  const topicKeys: Record<string, string> = {
    lecture: "reflections.topics.lecture",
    "daily reminder": "reflections.topics.dailyReminder",
    prayer: "reflections.topics.prayer",
    patience: "reflections.topics.patience",
    forgiveness: "reflections.topics.forgiveness",
    charity: "reflections.topics.charity",
    family: "reflections.topics.family",
    ramadan: "reflections.topics.ramadan",
  };

  const translationKey = topicKeys[normalized];

  return translationKey
    ? t(translationKey, { defaultValue: title })
    : title;
};

  return (
    <section className="px-4 py-6">
      <div className="relative mx-auto max-w-4xl">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/75">
            <Video className="h-4 w-4 text-islamic-gold" />
            {t("reflections.featuredReflections")}
          </div>

          {loading ? (
            <div className="rounded-2xl bg-black/40 p-8 text-center text-white/80">
              {t("reflections.loadingReflections")}
            </div>
          ) : featured ? (
            <>
              <button
                type="button"
                onClick={() =>
                  navigate(`/creator/${featured.user_id}`)
                }
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-islamic-green/40 px-4 py-3 text-left text-white"
              >
                {featured.creator_profile?.avatar_url ? (
                  <img
                    src={featured.creator_profile.avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full border border-white/20 object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-islamic-green font-bold text-white">
                    {(featured.creator_profile?.full_name ||
                      featured.creator_profile?.username ||
                      "T")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {featured.creator_profile?.full_name ||
                      featured.creator_profile?.username ||
                      t("reflections.tariqIslamCreator", {
                        defaultValue: "Tariq Islam Creator",
                      })}
                  </span>

                  <span className="mt-0.5 block text-xs text-white/70">
                    {getCategoryLabel(featured.category)} •{" "}
                    {getLanguageLabel(featured.language)}
                  </span>
                </span>
              </button>

            <div
              className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              style={{ touchAction: "pan-x" }}
              onTouchStartCapture={(event) => {
                const touch = event.touches[0];

                swipeStartXRef.current = touch.clientX;
                swipeStartYRef.current = touch.clientY;
              }}
              onTouchEndCapture={(event) => {
                if (
                  swipeStartXRef.current === null ||
                  swipeStartYRef.current === null ||
                  videos.length < 2
                ) {
                  swipeStartXRef.current = null;
                  swipeStartYRef.current = null;
                  return;
                }

                const touch = event.changedTouches[0];
                const horizontalDistance =
                  touch.clientX - swipeStartXRef.current;
                const verticalDistance =
                  touch.clientY - swipeStartYRef.current;

                swipeStartXRef.current = null;
                swipeStartYRef.current = null;

                const isVerticalSwipe =
                  Math.abs(verticalDistance) >= 60 &&
                  Math.abs(verticalDistance) >
                    Math.abs(horizontalDistance) * 1.2;

                if (!isVerticalSwipe) {
                  return;
                }

                if (verticalDistance < 0) {
                  setFeaturedIndex((current) =>
                    current < videos.length - 1 ? current + 1 : 0
                  );
                } else {
                  setFeaturedIndex((current) =>
                    current > 0 ? current - 1 : videos.length - 1
                  );
                }
              }}
            >
       <video
       key={featured.id}
         src={featured.video_url}
         poster={featured.thumbnail_url ?? undefined}
         controls
         muted
         autoPlay
         playsInline
         crossOrigin="anonymous"
         onLoadedMetadata={(event) => {
           const video = event.currentTarget;
           const start = Number(featured.trim_start_seconds ?? 0);

           if (start > 0 && start < video.duration) {
             video.currentTime = start;
           }
         }}
         onPlay={(event) => {
           const video = event.currentTarget;
           const start = Number(featured.trim_start_seconds ?? 0);
           const end =
             featured.trim_end_seconds === null
               ? null
               : Number(featured.trim_end_seconds);

           if (
             video.currentTime < start ||
             (end !== null && video.currentTime >= end)
           ) {
             video.currentTime = start;
           }
         }}

onTimeUpdate={(event) => {
  const video = event.currentTarget;
  const end =
    featured.trim_end_seconds === null
      ? null
      : Number(featured.trim_end_seconds);

  if (end !== null && video.currentTime >= end - 0.1) {
    video.pause();
    playNextFeaturedVideo();
  }
}}
onEnded={playNextFeaturedVideo}

className="h-full w-full object-cover"
/>
              </div>

              <div className="mt-3">
                <div className="text-lg font-semibold">{getTopicLabel(featured.title)}</div>

                <div className="text-sm text-white/70">
                  {getCategoryLabel(featured.category)} •{" "}
                  {getLanguageLabel(featured.language)}
                </div>
                {featured.reference_type === "quran" &&
                  featured.quran_surah_number &&
                  featured.quran_ayah_start && (
                    <div className="mt-3 rounded-xl border border-white/20 bg-black/30 p-3 text-sm">
                      <p className="font-semibold">
                        Quran {featured.quran_surah_number}:
                        {featured.quran_ayah_start}
                        {featured.quran_ayah_end &&
                          featured.quran_ayah_end !== featured.quran_ayah_start &&
                          `-${featured.quran_ayah_end}`}
                      </p>

                      {featured.reference_note && (
                        <p className="mt-1 text-xs text-white/70">
                          {featured.reference_note}
                        </p>
                      )}
                    </div>
                  )}

                {featured.reference_type === "hadith" && (
                  <div className="mt-3 rounded-xl border border-white/20 bg-black/30 p-3 text-sm">
                    <p className="font-semibold">
                      {featured.hadith_collection || "Hadith"}
                      {featured.hadith_number
                        ? `, Hadith ${featured.hadith_number}`
                        : ""}
                    </p>

                    {featured.reference_note && (
                      <p className="mt-1 text-xs text-white/70">
                        {featured.reference_note}
                      </p>
                    )}
                  </div>
                )}
              </div>

{videos.length > 1 && (
  <div className="mt-6 space-y-6">
    {videos.map((video, index) => {
      if (index === featuredIndex) return null;

      return (
        <article
          key={video.id}
          className="overflow-hidden rounded-2xl border border-white/15 bg-black/20"
        >
          <div className="aspect-video w-full bg-black">
            <video
              src={video.video_url}
              poster={video.thumbnail_url ?? undefined}
              controls
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              onPlay={() => setFeaturedIndex(index)}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="p-4">
            <h3 className="text-lg font-semibold text-white">
              {getTopicLabel(video.title)}
            </h3>

            <p className="mt-1 text-sm text-white/70">
              {getCategoryLabel(video.category)} •{" "}
              {getLanguageLabel(video.language)}
            </p>

            {video.caption && (
              <p className="mt-2 line-clamp-2 text-sm text-white/80">
                {video.caption}
              </p>
            )}
          </div>
        </article>
      );
    })}
  </div>
)}
            </>
          ) : (
            <div className="rounded-2xl bg-black/40 p-8 text-center">
              <PlayCircle className="mx-auto mb-3 h-14 w-14 text-islamic-gold" />

              <div className="font-semibold">
                {t("reflections.noApprovedReflections")}
              </div>

              <p className="mt-2 text-sm text-white/70">
                {t("reflections.uploadAfterApproval")}
              </p>
            </div>
          )}

          <Button
            type="button"
            onClick={() => navigate("/upload-reflection")}
            className="mt-4 w-full bg-islamic-green text-white hover:bg-islamic-green/90"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("reflections.uploadReflection")}
          </Button>

          <Button
            type="button"
            onClick={() => navigate("/reflections")}
            className="mt-3 w-full bg-islamic-gold text-black hover:bg-islamic-gold/90"
          >
            {t("reflections.seeAllReflections")}
          </Button>

          <div className="mt-4">
            <h2 className="text-2xl font-bold">
              {t("reflections.strengthenConnection")}
            </h2>

            <p className="mt-2 text-white/80">
              {t("reflections.communityReminders")}
            </p>
          </div>
        </div>
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
<div className="relative w-full max-w-4xl">
  <button
    type="button"
    onClick={() => setSelectedVideo(null)}
    className="absolute right-3 top-3 z-50 rounded-full bg-black/75 p-3 text-white shadow-xl backdrop-blur-sm hover:bg-black"
    aria-label={t("reflections.closeVideo")}
  >
    <X className="h-6 w-6" />
  </button>

<video
         key={selectedVideo.id}
         src={selectedVideo.video_url}
          poster={selectedVideo.thumbnail_url ?? undefined}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            const start = Number(selectedVideo.trim_start_seconds ?? 0);

            if (start > 0 && start < video.duration) {
              video.currentTime = start;
            }
          }}
          onPlay={(event) => {
            const video = event.currentTarget;
            const start = Number(selectedVideo.trim_start_seconds ?? 0);
            const end =
              selectedVideo.trim_end_seconds === null
                ? null
                : Number(selectedVideo.trim_end_seconds);

            if (
              video.currentTime < start ||
              (end !== null && video.currentTime >= end)
            ) {
              video.currentTime = start;
            }
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            const start = Number(selectedVideo.trim_start_seconds ?? 0);
            const end =
              selectedVideo.trim_end_seconds === null
                ? null
                : Number(selectedVideo.trim_end_seconds);

       if (end !== null && video.currentTime >= end) {
         video.pause();
         playNextSelectedVideo();
       }
          }}
          onEnded={playNextSelectedVideo}
          className="w-full rounded-2xl bg-black"
        />
            <div className="mt-3 text-white">
              <div className="font-semibold">{selectedVideo.title}</div>

          {selectedVideo.caption && (
                 <div className="text-sm text-white/70">
                   {selectedVideo.caption}
                 </div>
               )}

                     {selectedVideo.reference_type === "quran" &&
                       selectedVideo.quran_surah_number &&
                       selectedVideo.quran_ayah_start && (
                         <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
                           <p className="font-semibold">
                             Quran {selectedVideo.quran_surah_number}:
                             {selectedVideo.quran_ayah_start}
                             {selectedVideo.quran_ayah_end &&
                               selectedVideo.quran_ayah_end !==
                                 selectedVideo.quran_ayah_start &&
                               `-${selectedVideo.quran_ayah_end}`}
                           </p>

                           {selectedVideo.reference_note && (
                             <p className="mt-1 text-xs text-white/70">
                               {selectedVideo.reference_note}
                             </p>
                           )}
                         </div>
                       )}
                   {selectedVideo.reference_type === "hadith" && (
                                     <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
                                       <p className="font-semibold">
                                         {selectedVideo.hadith_collection || "Hadith"}
                                         {selectedVideo.hadith_number
                                           ? `, Hadith ${selectedVideo.hadith_number}`
                                           : ""}
                                       </p>

                                       {selectedVideo.reference_note && (
                                         <p className="mt-1 text-xs text-white/70">
                                           {selectedVideo.reference_note}
                                         </p>
                                       )}
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </div>

                         )}
                       </section>
                     );
                   }

