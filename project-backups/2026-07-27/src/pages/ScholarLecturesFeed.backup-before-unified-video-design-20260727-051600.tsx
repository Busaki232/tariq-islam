import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Loader2,
  MessageCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type LectureFeedItem = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  created_at: string;
  captions_enabled: boolean;
  captions_language: string | null;
  captions_segments: unknown[] | null;
  scholar_name: string;
  scholar_city: string | null;
  scholar_country: string | null;
};

type ScholarRow = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
};

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

const normalizeCaptionSegments = (
  value: unknown
): CaptionSegment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((segment, index) => {
      const item = segment as Partial<CaptionSegment>;

      return {
        id: typeof item.id === "number" ? item.id : index,
        start: Number(item.start),
        end: Number(item.end),
        text:
          typeof item.text === "string"
            ? item.text.trim()
            : "",
      };
    })
    .filter(
      (segment) =>
        Boolean(segment.text) &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
    );
};

const ScholarLecturesFeed = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [lectures, setLectures] = useState<LectureFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLectureId, setActiveLectureId] =
    useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [captionTimes, setCaptionTimes] =
    useState<Record<string, number>>({});
  const [
    selectedCaptionLanguages,
    setSelectedCaptionLanguages,
  ] = useState<Record<string, string>>({});
  const [collapsedCaptions, setCollapsedCaptions] =
    useState<Record<string, boolean>>({});
  const [
    translationsByLectureId,
    setTranslationsByLectureId,
  ] = useState<Record<string, CaptionTranslation[]>>({});

  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs =
    useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const loadFeed = async () => {
      setLoading(true);

      try {
        const { data: lectureRows, error: lectureError } =
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
                captions_enabled,
                captions_language,
                captions_segments
              `
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(50);

        if (lectureError) {
          throw lectureError;
        }

        const lectureIds = (lectureRows ?? []).map(
          (lecture) => lecture.id
        );

        const translationsMap: Record<
          string,
          CaptionTranslation[]
        > = {};

        if (lectureIds.length > 0) {
          const { data: translationRows, error: translationError } =
            await supabase
              .from("scholar_lecture_caption_translations")
              .select(
                "lecture_id,language_code,language_name,translated_segments"
              )
              .in("lecture_id", lectureIds)
              .order("language_name", { ascending: true });

          if (translationError) {
            console.error(
              "Unable to load feed caption translations:",
              translationError
            );
          } else {
            (translationRows ?? []).forEach((row) => {
              const lectureTranslations =
                translationsMap[row.lecture_id] ?? [];

              lectureTranslations.push({
                language_code: row.language_code,
                language_name: row.language_name,
                translated_segments: Array.isArray(
                  row.translated_segments
                )
                  ? normalizeCaptionSegments(
                      row.translated_segments
                    )
                  : null,
              });

              translationsMap[row.lecture_id] =
                lectureTranslations;
            });
          }
        }

        setTranslationsByLectureId(translationsMap);

        const scholarIds = Array.from(
          new Set(
            (lectureRows ?? []).map((lecture) => lecture.scholar_id)
          )
        );

        let scholarRows: ScholarRow[] = [];

        if (scholarIds.length > 0) {
          const { data, error } = await supabase
            .from("scholar_profiles")
            .select("id,display_name,city,country")
            .in("id", scholarIds)
            .eq("verification_status", "approved")
            .eq("is_active", true);

          if (error) {
            throw error;
          }

          scholarRows = (data ?? []) as ScholarRow[];
        }

        const scholarsById = new Map(
          scholarRows.map((scholar) => [scholar.id, scholar])
        );

        const items = (lectureRows ?? [])
          .map((lecture) => {
            const scholar = scholarsById.get(lecture.scholar_id);

            if (!scholar) {
              return null;
            }

            return {
              ...lecture,
              scholar_name: scholar.display_name,
              scholar_city: scholar.city,
              scholar_country: scholar.country,
            } as LectureFeedItem;
          })
          .filter(
            (lecture): lecture is LectureFeedItem =>
              lecture !== null
          );

        setLectures(items);
      } catch (error) {
        console.error("Unable to load scholar lecture feed:", error);
        setLectures([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFeed();
  }, []);

  useEffect(() => {
    if (loading || lectures.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              second.intersectionRatio - first.intersectionRatio
          )[0];

        if (!mostVisible || mostVisible.intersectionRatio < 0.65) {
          return;
        }

        const lectureId = (
          mostVisible.target as HTMLElement
        ).dataset.lectureId;

        if (!lectureId) {
          return;
        }

        setActiveLectureId(lectureId);

        videoRefs.current.forEach((video, id) => {
          if (id === lectureId) {
            video.muted = !soundEnabled;

            void video.play().catch((error) => {
              console.error("Unable to autoplay lecture:", error);
            });
          } else {
            video.pause();
          }
        });
      },
      {
        root: feedRef.current,
        threshold: [0.25, 0.5, 0.65, 0.8, 1],
      }
    );

    const cards = feedRef.current?.querySelectorAll<HTMLElement>(
      "[data-lecture-id]"
    );

    cards?.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();

      videoRefs.current.forEach((video) => video.pause());
    };
  }, [lectures, loading, soundEnabled]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label={t("common.back", {
            defaultValue: "Back",
          })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div>
          <h1 className="font-bold">
            {t("scholars.lectureFeed.title", {
              defaultValue: "Scholar Lectures",
            })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("scholars.lectureFeed.subtitle", {
              defaultValue: "Learn from verified scholars",
            })}
          </p>
        </div>
      </header>

      {lectures.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {t("scholars.lectureFeed.empty", {
              defaultValue: "No lectures available yet",
            })}
          </p>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="h-[calc(100dvh-8rem)] snap-y snap-proximity overflow-y-auto overscroll-y-contain"
        >
          {lectures.map((lecture) => {
            const isActive = activeLectureId === lecture.id;
            const lectureTranslations =
              translationsByLectureId[lecture.id] ?? [];
            const selectedCaptionLanguage =
              selectedCaptionLanguages[lecture.id] ?? "original";
            const originalCaptionSegments =
              normalizeCaptionSegments(lecture.captions_segments);
            const selectedTranslation =
              lectureTranslations.find(
                (translation) =>
                  translation.language_code ===
                  selectedCaptionLanguage
              );
            const activeSegments =
              selectedCaptionLanguage === "off"
                ? []
                : selectedCaptionLanguage === "original"
                  ? originalCaptionSegments
                  : selectedTranslation?.translated_segments ?? [];
            const currentCaptionTime =
              captionTimes[lecture.id] ?? 0;
            const activeCaption =
              activeSegments.find(
                (segment) =>
                  currentCaptionTime >= segment.start &&
                  currentCaptionTime < segment.end
              )?.text ?? "";
            const hasCaptionChoices =
              originalCaptionSegments.length > 0 ||
              lectureTranslations.some(
                (translation) =>
                  Array.isArray(
                    translation.translated_segments
                  ) &&
                  translation.translated_segments.length > 0
              );
            const captionsCollapsed =
              collapsedCaptions[lecture.id] ?? false;

            const location = [
              lecture.scholar_city,
              lecture.scholar_country,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <article
                key={lecture.id}
                data-lecture-id={lecture.id}
                className="snap-start border-b bg-background pb-5"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() =>
                    navigate(`/scholars/${lecture.scholar_id}`)
                  }
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {lecture.scholar_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "S"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-semibold">
                      {lecture.scholar_name}
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {location || formatDate(lecture.created_at)}
                    </p>
                  </div>
                </button>

                <div className="relative aspect-video overflow-hidden bg-slate-950">
                  <video
                    ref={(node) => {
                      if (node) {
                        videoRefs.current.set(lecture.id, node);
                      } else {
                        videoRefs.current.delete(lecture.id);
                      }
                    }}
                    src={lecture.video_url}
                    poster={lecture.thumbnail_url ?? undefined}
                    muted={!soundEnabled}
                    playsInline
                    preload="metadata"
                    loop
                    className="h-full w-full object-contain"
                    onTimeUpdate={(event) => {
                      const currentTime =
                        event.currentTarget.currentTime;

                      setCaptionTimes((current) => ({
                        ...current,
                        [lecture.id]: currentTime,
                      }));
                    }}
                    onClick={(event) => {
                      const video = event.currentTarget;

                      if (video.paused) {
                        void video.play();
                      } else {
                        video.pause();
                      }
                    }}
                  />

                  {!lecture.thumbnail_url && !isActive && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/30 via-slate-900 to-black px-8 text-center text-white">
                      <BookOpen className="mb-3 h-10 w-10" />
                      <p className="line-clamp-2 text-lg font-bold">
                        {lecture.title}
                      </p>
                      <p className="mt-1 text-sm text-white/75">
                        {lecture.scholar_name}
                      </p>
                    </div>
                  )}

                  {isActive && hasCaptionChoices && (
                    <div className="absolute bottom-12 left-1/2 z-10 w-[calc(100%-5rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-white/15 bg-black/75 text-white shadow-xl backdrop-blur-md">
                      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
                        <select
                          value={selectedCaptionLanguage}
                          onChange={(event) => {
                            const value = event.target.value;

                            setSelectedCaptionLanguages(
                              (current) => ({
                                ...current,
                                [lecture.id]: value,
                              })
                            );
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-sm font-semibold text-white outline-none"
                          aria-label={t(
                            "scholars.lectureFeed.captionLanguage",
                            {
                              defaultValue: "Caption language",
                            }
                          )}
                        >
                          <option value="off">
                            {t("scholars.lectureFeed.captionsOff", {
                              defaultValue: "Captions Off",
                            })}
                          </option>

                          {originalCaptionSegments.length > 0 && (
                            <option value="original">
                              {t("scholars.lectureFeed.original", {
                                defaultValue: "Original",
                              })}
                            </option>
                          )}

                          {lectureTranslations.map(
                            (translation) => (
                              <option
                                key={translation.language_code}
                                value={translation.language_code}
                              >
                                {translation.language_name}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg bg-white/10 text-lg"
                          onClick={() =>
                            setCollapsedCaptions((current) => ({
                              ...current,
                              [lecture.id]: !captionsCollapsed,
                            }))
                          }
                          aria-label={
                            captionsCollapsed
                              ? t(
                                  "scholars.lectureFeed.expandCaptions",
                                  {
                                    defaultValue: "Expand captions",
                                  }
                                )
                              : t(
                                  "scholars.lectureFeed.collapseCaptions",
                                  {
                                    defaultValue: "Collapse captions",
                                  }
                                )
                          }
                        >
                          {captionsCollapsed ? "+" : "−"}
                        </button>
                      </div>

                      {!captionsCollapsed &&
                        selectedCaptionLanguage !== "off" && (
                          <div
                            dir={
                              selectedCaptionLanguage === "ar" ||
                              selectedCaptionLanguage === "ur"
                                ? "rtl"
                                : "auto"
                            }
                            className="max-h-24 overflow-y-auto px-3 py-2 text-center text-sm font-medium leading-relaxed"
                          >
                            {activeCaption || (
                              <span className="text-white/55">
                                {t(
                                  "scholars.lectureFeed.captionsWillAppear",
                                  {
                                    defaultValue:
                                      "Captions will appear here",
                                  }
                                )}
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="absolute bottom-3 right-3 rounded-full bg-black/65 p-2 text-white"
                    onClick={() => {
                      const nextSound = !soundEnabled;
                      setSoundEnabled(nextSound);

                      const activeVideo =
                        videoRefs.current.get(lecture.id);

                      if (activeVideo) {
                        activeVideo.muted = !nextSound;
                      }
                    }}
                    aria-label={
                      soundEnabled
                        ? t("scholars.lectureFeed.muteVideo", {
                            defaultValue: "Mute video",
                          })
                        : t("scholars.lectureFeed.turnOnSound", {
                            defaultValue: "Turn on sound",
                          })
                    }
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-5 w-5" />
                    ) : (
                      <VolumeX className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="space-y-3 px-4 pt-3">
                  <h2 className="text-lg font-bold">
                    {lecture.title}
                  </h2>

                  {lecture.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {lecture.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
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

                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(lecture.created_at)}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      navigate(
                        `/scholars/${lecture.scholar_id}/lectures/${lecture.id}`
                      )
                    }
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {t("scholars.lectureFeed.openLecture", {
                      defaultValue: "Open Lecture and Comments",
                    })}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default ScholarLecturesFeed;
