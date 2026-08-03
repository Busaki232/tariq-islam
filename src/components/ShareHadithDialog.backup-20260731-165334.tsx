import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
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

type SunnahLanguageEntry = {
  lang: string;
  chapterNumber: string;
  chapterTitle: string;
  urn: number;
  body: string;
  grades: Array<{
    grade?: string;
    name?: string;
  }>;
};

type SunnahHadithRecord = {
  collection: string;
  bookNumber: string;
  chapterId: string;
  hadithNumber: string;
  hadith: SunnahLanguageEntry[];
};

type SunnahCollectionRecord = {
  name: string;
  collection: Array<{
    lang: string;
    title: string;
    shortIntro: string;
  }>;
  totalHadith: number;
  totalAvailableHadith: number;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  previous: number | null;
  next: number | null;
};

const API_URL = (
  import.meta.env.VITE_SUNNAH_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const stripHtml = (value: string) => {
  if (!value) return "";

  const documentNode = new DOMParser().parseFromString(value, "text/html");

  return (documentNode.body.textContent || "").replace(/\s+/g, " ").trim();
};

const getNarrator = (englishText: string) => {
  const match = englishText.match(
    /^(?:Narrated|It was narrated from|It was narrated that)\s+([^:]+):/i
  );

  return match?.[1]?.trim() || "Narrator recorded in source";
};

const getCollectionTitle = (collection: SunnahCollectionRecord | undefined) => {
  return (
    collection?.collection.find((entry) => entry.lang === "en")?.title ||
    collection?.name ||
    "Hadith Collection"
  );
};

const mapHadith = (
  record: SunnahHadithRecord,
  collectionTitle: string
): HadithData => {
  const englishEntry = record.hadith.find((entry) => entry.lang === "en");

  const arabicEntry = record.hadith.find((entry) => entry.lang === "ar");

  const englishText = stripHtml(englishEntry?.body || "");
  const arabicText = stripHtml(arabicEntry?.body || "");

  const gradeEntry = englishEntry?.grades?.[0];
  const grade =
    gradeEntry?.grade?.trim() || gradeEntry?.name?.trim() || undefined;

  return {
    arabicText,
    englishText,
    narrator: getNarrator(englishText),
    book: collectionTitle,
    reference: `Book ${record.bookNumber}, Hadith ${record.hadithNumber}`,
    grade,
  };
};

export const ShareHadithDialog = ({
  onShare,
  trigger,
}: ShareHadithDialogProps) => {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<SunnahCollectionRecord[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [hadithNumber, setHadithNumber] = useState("");
  const [hadiths, setHadiths] = useState<SunnahHadithRecord[]>([]);

  const [page, setPage] = useState(1);
  const [previousPage, setPreviousPage] = useState<number | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);

  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [hadithsLoading, setHadithsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCollectionRecord = useMemo(
    () =>
      collections.find((collection) => collection.name === selectedCollection),
    [collections, selectedCollection]
  );

  const collectionTitle = getCollectionTitle(selectedCollectionRecord);

  const mappedHadiths = useMemo(
    () => hadiths.map((hadith) => mapHadith(hadith, collectionTitle)),
    [collectionTitle, hadiths]
  );

  const loadCollections = useCallback(async () => {
    try {
      setCollectionsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/v1/collections?limit=100`);

      if (!response.ok) {
        throw new Error(`The Sunnah API returned ${response.status}.`);
      }

      const result =
        (await response.json()) as PaginatedResponse<SunnahCollectionRecord>;

      setCollections(result.data || []);
    } catch (loadError) {
      console.error("Unable to load Sunnah collections:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load hadith collections."
      );
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  const loadHadiths = useCallback(
    async (
      collection: string,
      requestedPage: number,
      requestedHadithNumber = ""
    ) => {
      if (!collection) {
        setHadiths([]);
        return;
      }

      try {
        setHadithsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          collection,
          page: String(requestedPage),
          limit: "20",
        });

        const trimmedNumber = requestedHadithNumber.trim();

        if (trimmedNumber) {
          params.set("hadithNumber", trimmedNumber);
        }

        const response = await fetch(
          `${API_URL}/v1/hadiths?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`The Sunnah API returned ${response.status}.`);
        }

        const result =
          (await response.json()) as PaginatedResponse<SunnahHadithRecord>;

        setHadiths(result.data || []);
        setPage(requestedPage);
        setPreviousPage(result.previous);
        setNextPage(result.next);
      } catch (loadError) {
        console.error("Unable to load Sunnah hadiths:", loadError);

        setHadiths([]);
        setPreviousPage(null);
        setNextPage(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load hadiths."
        );
      } finally {
        setHadithsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open || collections.length > 0) return;

    void loadCollections();
  }, [collections.length, loadCollections, open]);

  const handleCollectionChange = (collection: string) => {
    setSelectedCollection(collection);
    setHadithNumber("");
    setPage(1);
    void loadHadiths(collection, 1);
  };

  const handleSearch = () => {
    if (!selectedCollection) {
      toast.error("Select a hadith collection first.");
      return;
    }

    void loadHadiths(selectedCollection, 1, hadithNumber);
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

      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Hadith</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="collection">Hadith Collection</Label>

            <Select
              value={selectedCollection}
              onValueChange={handleCollectionChange}
              disabled={collectionsLoading}
            >
              <SelectTrigger id="collection">
                <SelectValue
                  placeholder={
                    collectionsLoading
                      ? "Loading collections..."
                      : "Select Collection"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {collections.map((collection) => (
                  <SelectItem key={collection.name} value={collection.name}>
                    {getCollectionTitle(collection)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hadith-number">Hadith Number</Label>

            <div className="flex gap-2">
              <Input
                id="hadith-number"
                inputMode="numeric"
                placeholder="Optional, for example 1"
                value={hadithNumber}
                disabled={!selectedCollection}
                onChange={(event) => setHadithNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
              />

              <Button
                type="button"
                variant="outline"
                disabled={!selectedCollection || hadithsLoading}
                onClick={handleSearch}
                aria-label="Find hadith"
              >
                {hadithsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Leave the number empty to browse the collection.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <ScrollArea className="h-[430px] rounded-md border">
            <div className="space-y-4 p-4">
              {hadithsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading hadiths...
                </div>
              ) : mappedHadiths.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  {selectedCollection
                    ? "No hadiths found."
                    : "Select a collection to view hadiths."}
                </p>
              ) : (
                mappedHadiths.map((hadith, index) => (
                  <button
                    key={`${hadith.reference}-${index}`}
                    type="button"
                    className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
                    onClick={() => handleShareHadith(hadith)}
                  >
                    {hadith.arabicText && (
                      <p
                        dir="rtl"
                        lang="ar"
                        className="mb-4 text-right text-lg leading-9"
                      >
                        {hadith.arabicText}
                      </p>
                    )}

                    <p className="mb-3 text-sm leading-6">
                      {hadith.englishText}
                    </p>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        {hadith.book} · {hadith.reference}
                      </p>

                      <p>{hadith.narrator}</p>

                      {hadith.grade && <p>Grade: {hadith.grade}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedCollection &&
            !hadithNumber.trim() &&
            mappedHadiths.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previousPage === null || hadithsLoading}
                  onClick={() => {
                    if (previousPage !== null) {
                      void loadHadiths(selectedCollection, previousPage);
                    }
                  }}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <span className="text-sm text-muted-foreground">
                  Page {page}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  disabled={nextPage === null || hadithsLoading}
                  onClick={() => {
                    if (nextPage !== null) {
                      void loadHadiths(selectedCollection, nextPage);
                    }
                  }}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

          <p className="text-center text-xs text-muted-foreground">
            Select a hadith to share it in the chat.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
