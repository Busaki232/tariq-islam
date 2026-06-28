// src/components/quran/QuranPlayer.tsx
import { allSurahs, reciters, type Reciter, type Surah } from "@/data/quranData";
import SurahSelector from "./SurahSelector";
import ReciterSelector from "./ReciterSelector";
import PlaybackControls from "./PlaybackControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QuranPlayerProps {
  isPlaying: boolean;
  currentSurah: Surah | null;
  currentReciter: Reciter | null;
  progress: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  userInteracted: boolean;
  loadSurah: (surah: Surah, reciter: Reciter) => Promise<void>;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  changeVolume: (volume: number) => void;
  selectedReciter: Reciter;
  onReciterChange: (reciter: Reciter) => void;
}

export default function QuranPlayer({
  isPlaying,
  currentSurah,
  currentReciter,
  progress,
  duration,
  volume,
  isLoading,
  error,
  userInteracted, // kept for compatibility
  loadSurah,
  togglePlayPause,
  seek,
  changeVolume,
  selectedReciter,
  onReciterChange,
}: QuranPlayerProps) {
  // IMPORTANT: load both namespaces
  const { t, i18n } = useTranslation(["quran", "common"]);

  // Helper: try multiple keys (and namespaces) before falling back to English
  const pickT = (keys: string[], fallback: string) => {
    for (const key of keys) {
      if (i18n.exists(key, { ns: "quran" })) return t(key, { ns: "quran" });
      if (i18n.exists(key, { ns: "common" })) return t(key, { ns: "common" });
    }
    return fallback;
  };

  const handleSurahSelect = (surah: Surah) => {
    void loadSurah(surah, selectedReciter);
  };

  const handleReciterSelect = (reciter: Reciter) => {
    onReciterChange(reciter);
    if (currentSurah) void loadSurah(currentSurah, reciter);
  };

  const getStartedSubtitle = pickT(
    [
      "getStartedSubtitle",
      "ui.getStartedSubtitle",
      "quran.getStartedSubtitle",
      "quranSection.getStartedSubtitle",
    ],
    t("getStartedSubtitle", {
      defaultValue: "Select a reciter and a surah below to begin listening to the Noble Quran.",
    })
  );

const howToListenTitle = pickT(
  ["howToListenTitle", "ui.howToListenTitle"],
  t("howToListenTitle", {
    defaultValue: "How to listen",
  })
);
const step1 = pickT(
  ["howToListenSteps.1", "ui.howToListenSteps.1"],
  t("howToListenSteps.1", {
    defaultValue: "Select a reciter.",
  })
);
const step2 = pickT(
  ["howToListenSteps.2", "ui.howToListenSteps.2"],
  t("howToListenSteps.2", {
    defaultValue: "Select a surah.",
  })
);
const step3 = pickT(
  ["howToListenSteps.3", "ui.howToListenSteps.3"],
  t("howToListenSteps.3", {
    defaultValue: "Press play to listen.",
  })
);

const recitedBy = pickT(
  ["ui.recitedBy", "recitedBy"],
  currentReciter
    ? t("recitedBy", {
        defaultValue: `Recited by: ${currentReciter}`,
        name: currentReciter,
      })
    : ""
);
  return (
    <Card className="w-full max-w-2xl mx-auto bg-card/50 backdrop-blur-sm border-islamic-accent/20 shadow-islamic">
      <CardHeader className="text-center border-b border-islamic-accent/10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="h-6 w-6 text-islamic-accent" aria-hidden="true" />
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-islamic-primary to-islamic-accent bg-clip-text text-transparent">
            {pickT(["playerTitle", "ui.playerTitle"], "Quran Player")}
          </CardTitle>
        </div>

        {currentSurah ? (
          <div className="space-y-1">
            <p className="text-3xl font-serif text-islamic-gold">{currentSurah.name}</p>
            <p className="text-lg font-semibold text-foreground">{currentSurah.englishName}</p>
            <p className="text-sm text-muted-foreground">{currentSurah.englishTranslation}</p>

            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
              <span>
                {t("versesCount", {
                  ns: "quran",
                  count: currentSurah.ayahs,
                  defaultValue: "{{count}} verses",
                })}
              </span>
              <span aria-hidden="true">•</span>
              <span>
                {t(`revelation.${String(currentSurah.revelation).toLowerCase()}`, {
                  ns: "quran",
                  defaultValue: String(currentSurah.revelation),
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <p className="text-lg font-medium text-muted-foreground">{getStartedSubtitle}</p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {!currentSurah && !error && (
          <div className="bg-muted/50 border border-islamic-gold/20 rounded-lg p-6 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">{howToListenTitle}</p>

            <ol className="text-sm text-muted-foreground space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-islamic-gold">1.</span>
                <span>{step1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-islamic-gold">2.</span>
                <span>{step2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-islamic-gold">3.</span>
                <span>{step3}</span>
              </li>
            </ol>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ReciterSelector
          reciters={reciters}
          onChange={handleReciterSelect}
          selectedReciter={selectedReciter}
        />

        <SurahSelector
          surahs={allSurahs}
          onSelect={handleSurahSelect}
          selectedSurah={currentSurah}
        />

        <PlaybackControls
          isPlaying={isPlaying}
          isLoading={isLoading}
          progress={progress}
          duration={duration}
          volume={volume}
          onPlayPause={togglePlayPause}
          onSeek={seek}
          onVolumeChange={changeVolume}
        />

        {currentReciter ? (
          <div className="text-center text-sm text-muted-foreground pt-4 border-t">
            {recitedBy.replace("{{name}}", currentReciter.name)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}