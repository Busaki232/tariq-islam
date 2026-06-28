// src/components/QuranSection.tsx
import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { BookOpen, Star, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

// ✅ Lazy-load the heavy player (and quranData it imports)
const QuranPlayer = lazy(() => import("./quran/QuranPlayer"));

// Keep these imports for now, but note: quranData is still heavy.
// This change alone helps a lot because QuranPlayer isn't loaded at startup anymore.
// If you want the next big win, we can split quranData into a lighter "popularSurahs" file.
import { popularSurahs, reciters, type Reciter } from "@/data/quranData";
import { useQuranPlayer } from "@/hooks/useQuranPlayer";

const QuranSection = () => {
  const { t } = useTranslation("quran");

  const playerRef = useRef<HTMLDivElement>(null);

  // Default to Al-Sudais safely
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(() => {
    return reciters?.[1] ?? reciters?.[0];
  });

  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // Only render/mount the heavy player after user intent on mobile (iOS gesture requirement).
  // On desktop we can mount immediately (fast enough + supports auto-load).
  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const [showPlayer, setShowPlayer] = useState(() => !isMobile);

  const quranPlayerState = useQuranPlayer();

  // Auto-load Al-Fatihah on desktop only (mobile requires user interaction)
  useEffect(() => {
    if (!showPlayer) return;
    if (isMobile) return;

    if (!hasAutoLoaded && !quranPlayerState.currentSurah) {
      const alFatihah = popularSurahs.find((s) => s.number === 1);
      if (alFatihah) {
        quranPlayerState.loadSurah(alFatihah, selectedReciter);
        setHasAutoLoaded(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlayer, hasAutoLoaded, isMobile, quranPlayerState.currentSurah]);

  const scrollToPlayer = () => {
    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handlePopularSurahClick = (surah: (typeof popularSurahs)[0]) => {
    if (isMobile && !showPlayer) setShowPlayer(true);

    quranPlayerState.loadSurah(surah, selectedReciter);

    toast({
      title: t("quranSection.toast.loadingTitle", { defaultValue: "Loading Surah" }),
      description: `${surah.englishName} - ${surah.name}`,
    });

    scrollToPlayer();
  };

  const handleLoadPlayer = () => {
    setShowPlayer(true);

    toast({
      title: t("quranSection.toast.loadingTitle", { defaultValue: "Loading Surah" }),
      description: t("quranSection.toast.loadingDesc", { defaultValue: "Preparing the player..." }),
    });

    scrollToPlayer();
  };

  return (
    <section
      id="quran-section"
      className="scroll-mt-24 py-16 px-4 bg-gradient-to-br from-background to-muted"
    >
      {/* Islamic geometric pattern background */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234ade80' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-islamic-gold animate-pulse" />
            <Star className="h-5 w-5 text-islamic-gold" />
          </div>

          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-islamic-green to-islamic-gold bg-clip-text text-transparent">
            {t("quranSection.title", { defaultValue: "Listen to the Holy Quran" })}
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("quranSection.subtitle", {
              defaultValue:
                "Experience spiritual tranquility through beautiful Quranic recitations by world-renowned reciters",
            })}
          </p>
        </div>

        {/* Main Player */}
        <div ref={playerRef} className="mb-12">
          {!showPlayer ? (
            <Card className="bg-card/50 backdrop-blur-sm border-islamic-gold/20">
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-base font-semibold">
                  {t("quranSection.getStartedTitle", { defaultValue: "Get started" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("quranSection.getStartedSubtitle", {
                    defaultValue: "Tap below to load the Quran player.",
                  })}
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleLoadPlayer}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-primary-foreground text-sm"
                  >
                    {t("quranSection.loadPlayer", { defaultValue: "Load Quran Player" })}
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Suspense
              fallback={
                <Card className="bg-card/50 backdrop-blur-sm border-islamic-gold/20">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">
                      {t("common:loading", { defaultValue: "Loading..." })}
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <QuranPlayer
                {...quranPlayerState}
                selectedReciter={selectedReciter}
                onReciterChange={setSelectedReciter}
              />
            </Suspense>
          )}
        </div>

        {/* Popular Surahs Grid */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Heart className="h-5 w-5 text-islamic-gold" />
            {t("quranSection.popular.title", { defaultValue: "Popular Surahs" })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularSurahs.map((surah) => (
              <button
                key={surah.number}
                onClick={() => handlePopularSurahClick(surah)}
                className="w-full text-left touch-manipulation cursor-pointer active:opacity-90"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                  touchAction: "manipulation",
                  minHeight: "44px",
                  minWidth: "44px",
                }}
                type="button"
              >
                <Card className="group hover:shadow-islamic transition-all duration-300 bg-card/50 backdrop-blur-sm border-islamic-gold/20 hover:border-islamic-gold/40 hover:scale-105 active:scale-95">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-islamic-green to-islamic-gold flex items-center justify-center text-white font-bold">
                        {surah.number}
                      </div>
                      <Star className="h-4 w-4 text-islamic-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-2xl font-serif text-islamic-gold">{surah.name}</p>
                      <p className="font-semibold text-foreground">{surah.englishName}</p>
                      <p className="text-xs text-muted-foreground">{surah.englishTranslation}</p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                        <span>
                          {t("quranSection.popular.versesCount", {
                            count: surah.ayahs,
                            defaultValue: "{{count}} verses",
                          })}
                        </span>
                        <span>•</span>
                        <span>{surah.revelation}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>

        {/* Inspirational Quote */}
        <div className="mt-12 text-center">
          <Card className="max-w-3xl mx-auto bg-gradient-to-r from-islamic-green/10 to-islamic-gold/10 border-islamic-gold/20">
            <CardContent className="p-6">
              <p className="text-lg italic text-muted-foreground">
                {t("quranSection.quote.text", {
                  defaultValue:
                    "Indeed, it is We who sent down the Quran and indeed, We will be its guardian.",
                })}
              </p>
              <p className="text-sm font-semibold text-islamic-gold mt-2">
                {t("quranSection.quote.ref", { defaultValue: "- Surah Al-Hijr (15:9)" })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default QuranSection;