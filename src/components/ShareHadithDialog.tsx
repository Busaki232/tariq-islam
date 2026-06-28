import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area";

interface ShareHadithDialogProps {
  onShare: (hadith: HadithData) => void;
  trigger?: React.ReactNode;
}

export interface HadithData {
  arabicText: string;
  englishText: string;
  narrator: string;
  book: string;
  reference: string;
  grade?: string;
}

const hadithCollections = [
  { id: "bukhari", name: "Sahih Bukhari" },
  { id: "muslim", name: "Sahih Muslim" },
  { id: "abudawud", name: "Sunan Abu Dawud" },
  { id: "tirmidhi", name: "Jami` at-Tirmidhi" },
  { id: "nasai", name: "Sunan an-Nasa'i" },
  { id: "ibnmajah", name: "Sunan Ibn Majah" },
];

// Sample hadiths for demo - in production, you'd fetch from an API
const sampleHadiths: Record<string, HadithData[]> = {
  bukhari: [
    {
      arabicText: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
      englishText: "Actions are but by intentions, and every man shall have only that which he intended.",
      narrator: "Umar ibn Al-Khattab",
      book: "Sahih Bukhari",
      reference: "Book 1, Hadith 1",
      grade: "Sahih"
    }
  ],
  muslim: [
    {
      arabicText: "مَنْ غَشَّنَا فَلَيْسَ مِنَّا",
      englishText: "He who cheats us is not one of us.",
      narrator: "Abu Hurairah",
      book: "Sahih Muslim",
      reference: "Book 1, Hadith 164",
      grade: "Sahih"
    }
  ]
};

export const ShareHadithDialog = ({ onShare, trigger }: ShareHadithDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredHadiths, setFilteredHadiths] = useState<HadithData[]>([]);

  const handleCollectionChange = (collection: string) => {
    setSelectedCollection(collection);
    setFilteredHadiths(sampleHadiths[collection] || []);
  };

  const handleShareHadith = (hadith: HadithData) => {
    onShare(hadith);
    setOpen(false);
    toast.success("Hadith shared!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Share Hadith
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Share Hadith</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="collection">Hadith Collection</Label>
            <Select value={selectedCollection} onValueChange={handleCollectionChange}>
              <SelectTrigger id="collection">
                <SelectValue placeholder="Select Collection" />
              </SelectTrigger>
              <SelectContent>
                {hadithCollections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search hadith..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="space-y-4">
              {filteredHadiths.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {selectedCollection ? "No hadiths found" : "Select a collection to view hadiths"}
                </p>
              ) : (
                filteredHadiths.map((hadith, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleShareHadith(hadith)}
                  >
                    <p className="text-sm mb-2">{hadith.englishText}</p>
                    <p className="text-xs text-muted-foreground">
                      {hadith.narrator} - {hadith.reference}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground text-center">
            Click on a hadith to share it in the chat
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
