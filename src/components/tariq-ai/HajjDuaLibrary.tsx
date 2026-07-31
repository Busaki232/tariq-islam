import { useEffect, useMemo, useState } from "react";
import {
  BookHeart,
  Check,
  Copy,
  Heart,
  Search,
  Share2,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type DuaCategory =
  | "all"
  | "guidance"
  | "forgiveness"
  | "wellbeing"
  | "confidence"
  | "favorites";

type HajjDua = {
  id: string;
  title: string;
  category: Exclude<DuaCategory, "all" | "favorites">;
  reference: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  note: string;
};

const FAVORITES_KEY = "tariq_ai_hajj_dua_favorites_v1";

const duas: HajjDua[] = [
  {
    id: "world-hereafter",
    title: "Good in this life and the Hereafter",
    category: "wellbeing",
    reference: "Quran 2:201",
    arabic:
      "رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةًۭ وَفِى ٱلْـَٔاخِرَةِ حَسَنَةًۭ وَقِنَا عَذَابَ ٱلنَّارِ",
    transliteration:
      "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina ‘adhaban-nar.",
    meaning:
      "Our Lord, grant us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
    note:
      "A comprehensive Quranic supplication for wellbeing, righteousness and protection.",
  },
  {
    id: "forgiveness",
    title: "Forgiveness and mercy",
    category: "forgiveness",
    reference: "Quran 7:23",
    arabic:
      "رَبَّنَا ظَلَمْنَآ أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ ٱلْخَـٰسِرِينَ",
    transliteration:
      "Rabbana zalamna anfusana wa illam taghfir lana wa tarhamna lanakunanna minal-khasirin.",
    meaning:
      "Our Lord, we have wronged ourselves. If You do not forgive us and have mercy on us, we will certainly be among the losers.",
    note:
      "A Quranic supplication of repentance, humility and hope in Allah’s mercy.",
  },
  {
    id: "steadfast-hearts",
    title: "Steadfastness after guidance",
    category: "guidance",
    reference: "Quran 3:8",
    arabic:
      "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ ٱلْوَهَّابُ",
    transliteration:
      "Rabbana la tuzigh qulubana ba‘da idh hadaytana wa hab lana milladunka rahmah. Innaka antal-Wahhab.",
    meaning:
      "Our Lord, do not let our hearts deviate after You have guided us. Grant us mercy from Yourself. You are truly the Giver.",
    note:
      "A Quranic supplication for guidance, spiritual stability and mercy.",
  },
  {
    id: "ease-and-speech",
    title: "Ease, confidence and clear speech",
    category: "confidence",
    reference: "Quran 20:25–28",
    arabic:
      "رَبِّ ٱشْرَحْ لِى صَدْرِى ۝ وَيَسِّرْ لِىٓ أَمْرِى ۝ وَٱحْلُلْ عُقْدَةًۭ مِّن لِّسَانِى ۝ يَفْقَهُوا۟ قَوْلِى",
    transliteration:
      "Rabbi ishrah li sadri, wa yassir li amri, wahlul ‘uqdatan min lisani, yafqahu qawli.",
    meaning:
      "My Lord, uplift my heart for me, make my task easy, and remove the impediment from my tongue so people may understand my speech.",
    note:
      "The supplication of Prophet Musa for confidence, ease and clarity.",
  },
];

const filters: Array<{
  id: DuaCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "wellbeing", label: "Wellbeing" },
  { id: "forgiveness", label: "Forgiveness" },
  { id: "guidance", label: "Guidance" },
  { id: "confidence", label: "Confidence" },
  { id: "favorites", label: "Favorites" },
];

const buildShareText = (dua: HajjDua) =>
  `${dua.title}

${dua.arabic}

${dua.transliteration}

${dua.meaning}

Reference: ${dua.reference}`;

const HajjDuaLibrary = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState<DuaCategory>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);

      if (!stored) return;

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setFavorites(
          parsed.filter((item) => typeof item === "string")
        );
      }
    } catch (error) {
      console.error("Unable to load dua favorites:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error("Unable to save dua favorites:", error);
    }
  }, [favorites]);

  const visibleDuas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return duas.filter((dua) => {
      const matchesCategory =
        category === "all"
          ? true
          : category === "favorites"
            ? favorites.includes(dua.id)
            : dua.category === category;

      if (!matchesCategory) return false;

      if (!normalizedQuery) return true;

      const searchable = [
        dua.title,
        dua.reference,
        dua.transliteration,
        dua.meaning,
        dua.note,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [category, favorites, query]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const copyDua = async (dua: HajjDua) => {
    try {
      await navigator.clipboard.writeText(
        buildShareText(dua)
      );

      setCopiedId(dua.id);

      window.setTimeout(() => {
        setCopiedId("");
      }, 1800);
    } catch (error) {
      console.error("Unable to copy dua:", error);
    }
  };

  const shareDua = async (dua: HajjDua) => {
    const text = buildShareText(dua);

    try {
      if (navigator.share) {
        await navigator.share({
          title: dua.title,
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(text);
      setCopiedId(dua.id);

      window.setTimeout(() => {
        setCopiedId("");
      }, 1800);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Unable to share dua:", error);
      }
    }
  };

  return (
    <section className="mb-5 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookHeart className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-semibold">
            Hajj Dua Library
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Quranic supplications with Arabic,
            transliteration, meaning and exact references.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />

        <p className="text-xs leading-relaxed text-muted-foreground">
          These duas are included inside the app and remain
          available offline. Transliteration is an aid only;
          Arabic pronunciation should be learned from a
          qualified teacher or reliable recitation.
        </p>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Search duas..."
          className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const active = category === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setCategory(filter.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {visibleDuas.map((dua) => {
          const favorite = favorites.includes(dua.id);
          const copied = copiedId === dua.id;

          return (
            <article
              key={dua.id}
              className="rounded-2xl border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {dua.title}
                  </h3>

                  <p className="mt-1 text-xs font-medium text-primary">
                    {dua.reference}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(dua.id)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                    favorite
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                  aria-label={
                    favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  <Heart
                    className={`h-4 w-4 ${
                      favorite ? "fill-current" : ""
                    }`}
                  />
                </button>
              </div>

              <p
                dir="rtl"
                lang="ar"
                className="mt-4 text-right font-serif text-2xl leading-[2.1]"
              >
                {dua.arabic}
              </p>

              <div className="mt-4 rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transliteration
                </p>

                <p className="mt-1 text-sm italic leading-relaxed">
                  {dua.transliteration}
                </p>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Meaning
                </p>

                <p className="mt-1 text-sm leading-relaxed">
                  {dua.meaning}
                </p>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {dua.note}
              </p>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyDua(dua)}
                  className="flex-1"
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void shareDua(dua)}
                  className="flex-1"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </article>
          );
        })}

        {visibleDuas.length === 0 && (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium">
              No duas found
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try another search or category.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        This section contains Quranic supplications.
        General personal duas may also be made in your own
        words, but they should not be presented as Quran or
        Hadith without a verified source.
      </p>
    </section>
  );
};

export default HajjDuaLibrary;
