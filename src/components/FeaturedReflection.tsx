import { useEffect, useState } from "react";
import { PlayCircle, Upload, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ReflectionVideo = {
  id: string;
  title: string;
  caption: string | null;
  category: string;
  language: string;
  video_url: string;
  created_at: string;
};

export default function FeaturedReflection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [videos, setVideos] = useState<ReflectionVideo[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<ReflectionVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVideos = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("reflection_videos")
        .select(
          "id, title, caption, category, language, video_url, created_at"
        )
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!error && data) {
        setVideos(data as ReflectionVideo[]);
      }

      setLoading(false);
    };

    void loadVideos();
  }, []);

  const featured = videos[0];

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
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video
                  src={featured.video_url}
                  controls
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="mt-3">
                <div className="text-lg font-semibold">{featured.title}</div>

                <div className="text-sm text-white/70">
                  {featured.category} • {featured.language}
                </div>
              </div>

              {videos.length > 1 && (
                <div className="mt-4 grid gap-3">
                  {videos.slice(1).map((video) => (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => setSelectedVideo(video)}
                      className="flex items-center gap-3 rounded-xl bg-white/10 p-3 text-left hover:bg-white/15"
                    >
                      <PlayCircle className="h-8 w-8 text-islamic-gold" />

                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {video.title}
                        </div>

                        <div className="text-xs text-white/70">
                          {video.category} • {video.language}
                        </div>
                      </div>
                    </button>
                  ))}
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
          <div className="w-full max-w-4xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label={t("reflections.closeVideo")}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <video
              src={selectedVideo.video_url}
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl bg-black"
            />

            <div className="mt-3 text-white">
              <div className="font-semibold">{selectedVideo.title}</div>

              {selectedVideo.caption && (
                <div className="text-sm text-white/70">
                  {selectedVideo.caption}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}