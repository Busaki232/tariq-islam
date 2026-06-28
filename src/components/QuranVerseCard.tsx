import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Play, Pause, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuranVerseCardProps {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  arabicText: string;
  translation: string;
  reciterUrl?: string;
}

export const QuranVerseCard = ({
  surahNumber,
  surahName,
  ayahNumber,
  arabicText,
  translation,
  reciterUrl
}: QuranVerseCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayPause = () => {
    if (!reciterUrl) return;

    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio) {
        const newAudio = new Audio(reciterUrl);
        newAudio.addEventListener('ended', () => setIsPlaying(false));
        setAudio(newAudio);
        newAudio.play();
      } else {
        audio.play();
      }
      setIsPlaying(true);
    }
  };

  return (
    <Card className="overflow-hidden border-islamic-green/20 bg-gradient-to-br from-background to-islamic-green/5">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-islamic-green/20">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-islamic-green" />
            <span className="font-semibold text-sm">Quran</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {surahName} {surahNumber}:{ayahNumber}
          </span>
        </div>

        {/* Arabic Text */}
        <div className="text-right" dir="rtl">
          <p className="text-2xl leading-relaxed font-arabic text-foreground">
            {arabicText}
          </p>
        </div>

        {/* Translation */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-sm text-muted-foreground italic leading-relaxed">
            {translation}
          </p>
        </div>

        {/* Audio Player */}
        {reciterUrl && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayPause}
              className="gap-2"
            >
              {isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {isPlaying ? "Pause" : "Play"} Recitation
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
