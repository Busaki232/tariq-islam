import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type MosqueLivestream = {
  id: string;
  mosque_id: string;
  created_by: string;
  title: string;
  description: string | null;
  stream_url: string;
  scheduled_for: string | null;
  status: "upcoming" | "live" | "ended";
  created_at: string;
  updated_at: string;
};

const getYouTubeVideoId = (
  streamUrl: string
): string | null => {
  try {
    const url = new URL(streamUrl);
    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const pathParts = url.pathname
        .split("/")
        .filter(Boolean);

      if (
        pathParts[0] === "live" ||
        pathParts[0] === "embed" ||
        pathParts[0] === "shorts"
      ) {
        return pathParts[1] ?? null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const MosqueLivestreamViewer = () => {
  const navigate = useNavigate();

  const { mosqueId, livestreamId } = useParams<{
    mosqueId: string;
    livestreamId: string;
  }>();

  const [livestream, setLivestream] =
    useState<MosqueLivestream | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadLivestream = async () => {
      if (!mosqueId || !livestreamId) {
        setLoadError("Livestream information is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("mosque_livestreams")
          .select(
            "id,mosque_id,created_by,title,description,stream_url,scheduled_for,status,created_at,updated_at"
          )
          .eq("id", livestreamId)
          .eq("mosque_id", mosqueId)
          .single();

        if (error) {
          throw error;
        }

        setLivestream(data as MosqueLivestream);
      } catch (error) {
        console.error(
          "Could not load mosque livestream:",
          error
        );

        setLoadError(
          "This livestream could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadLivestream();
  }, [mosqueId, livestreamId]);

  const youtubeVideoId = useMemo(() => {
    if (!livestream?.stream_url) {
      return null;
    }

    return getYouTubeVideoId(livestream.stream_url);
  }, [livestream?.stream_url]);

  const youtubeEmbedUrl = youtubeVideoId
    ? `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=${
        livestream?.status === "live" ? "1" : "0"
      }&playsinline=1&rel=0`
    : null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <p className="text-muted-foreground">
          Loading livestream...
        </p>
      </main>
    );
  }

  if (loadError || !livestream) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl p-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            navigate(
              mosqueId ? `/mosques/${mosqueId}` : "/mosques"
            )
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mosque
        </Button>

        <div className="mt-6 rounded-2xl border bg-card p-6">
          <h1 className="text-xl font-semibold">
            Livestream unavailable
          </h1>

          <p className="mt-2 text-muted-foreground">
            {loadError ||
              "This livestream could not be found."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          navigate(`/mosques/${livestream.mosque_id}`)
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Mosque
      </Button>

      <section className="overflow-hidden rounded-2xl border bg-card">
        {youtubeEmbedUrl ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={youtubeEmbedUrl}
              title={livestream.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-muted p-6 text-center">
            <div>
              <p className="font-medium">
                This provider cannot be embedded directly.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Open the stream only when you are ready to
                leave the in-app viewer.
              </p>

              <Button
                type="button"
                className="mt-4"
                onClick={() =>
                  window.open(
                    livestream.stream_url,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Stream
              </Button>
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">
              {livestream.title}
            </h1>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                livestream.status === "live"
                  ? "bg-red-100 text-red-700"
                  : livestream.status === "upcoming"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {livestream.status === "live"
                ? "LIVE NOW"
                : livestream.status === "upcoming"
                  ? "UPCOMING"
                  : "ENDED"}
            </span>
          </div>

          {livestream.scheduled_for && (
            <p className="mt-3 text-sm text-muted-foreground">
              {new Date(
                livestream.scheduled_for
              ).toLocaleString()}
            </p>
          )}

          {livestream.description && (
            <p className="mt-4 whitespace-pre-line text-muted-foreground">
              {livestream.description}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default MosqueLivestreamViewer;
