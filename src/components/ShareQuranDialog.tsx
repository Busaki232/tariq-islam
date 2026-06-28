import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { allSurahs } from "@/data/quranData";

interface ShareQuranDialogProps {
  onShare: (verse: QuranVerseData) => void;
  trigger?: React.ReactNode;
}

export interface QuranVerseData {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  arabicText: string;
  translation: string;
  reciterUrl: string;
}

export const ShareQuranDialog = ({ onShare, trigger }: ShareQuranDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<string>("");
  const [ayahNumber, setAyahNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!selectedSurah || !ayahNumber) {
      toast.error("Please select a surah and ayah number");
      return;
    }

    const surah = allSurahs.find(s => s.number.toString() === selectedSurah);
    if (!surah) return;

    const ayah = parseInt(ayahNumber);
    if (ayah < 1 || ayah > surah.ayahs) {
      toast.error(`Ayah number must be between 1 and ${surah.ayahs}`);
      return;
    }

    setLoading(true);

    try {
      // Fetch verse from Quran API
      const response = await fetch(
        `https://api.alquran.cloud/v1/ayah/${surah.number}:${ayah}/editions/quran-uthmani,en.sahih`
      );
      const data = await response.json();

      if (data.code === 200 && data.data) {
        const arabicText = data.data[0].text;
        const translation = data.data[1].text;

        // Get audio URL
        const audioResponse = await fetch(
          `https://api.alquran.cloud/v1/ayah/${surah.number}:${ayah}/ar.alafasy`
        );
        const audioData = await audioResponse.json();
        const reciterUrl = audioData.data?.audio || "";

        onShare({
          surahNumber: surah.number,
          surahName: surah.name,
          ayahNumber: ayah,
          arabicText,
          translation,
          reciterUrl
        });

        setOpen(false);
        setSelectedSurah("");
        setAyahNumber("");
        toast.success("Quran verse shared!");
      } else {
        toast.error("Failed to fetch verse");
      }
    } catch (error) {
      console.error("Error fetching verse:", error);
      toast.error("Failed to load verse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Share Quran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Quran Verse</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="surah">Surah</Label>
            <Select value={selectedSurah} onValueChange={setSelectedSurah}>
              <SelectTrigger id="surah">
                <SelectValue placeholder="Select Surah" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {allSurahs.map((surah) => (
                  <SelectItem key={surah.number} value={surah.number.toString()}>
                    {surah.number}. {surah.name} ({surah.englishName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ayah">Ayah Number</Label>
            <Input
              id="ayah"
              type="number"
              min="1"
              placeholder="Enter ayah number"
              value={ayahNumber}
              onChange={(e) => setAyahNumber(e.target.value)}
            />
            {selectedSurah && (
              <p className="text-xs text-muted-foreground">
                {allSurahs.find(s => s.number.toString() === selectedSurah)?.name} has{" "}
                {allSurahs.find(s => s.number.toString() === selectedSurah)?.ayahs} ayahs
              </p>
            )}
          </div>

          <Button
            onClick={handleShare}
            disabled={!selectedSurah || !ayahNumber || loading}
            className="w-full"
          >
            {loading ? "Loading..." : "Share Verse"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
