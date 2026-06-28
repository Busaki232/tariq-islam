// src/components/quran/SurahSelector.tsx
import { useMemo, useState } from "react";
import { Surah } from "@/data/quranData";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface SurahSelectorProps {
  surahs: Surah[];
  onSelect: (surah: Surah) => void;
  selectedSurah: Surah | null;
}

const SurahSelector = ({ surahs, onSelect, selectedSurah }: SurahSelectorProps) => {
  const { t } = useTranslation("quran");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSurahs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return surahs;

    return surahs.filter((s) => {
      const enName = (s.englishName ?? "").toLowerCase();
      const enTr = (s.englishTranslation ?? "").toLowerCase();
      const arName = (s.name ?? "").toLowerCase();
      const num = String(s.number);

      return (
        enName.includes(q) ||
        enTr.includes(q) ||
        arName.includes(q) ||
        num.includes(q)
      );
    });
  }, [searchTerm, surahs]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder={t("ui.searchSurahPlaceholder", {
            defaultValue: "Search surah by name or number...",
          })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-background/50 border-islamic-gold/20 focus:border-islamic-gold"
        />
      </div>

      <Select
        value={selectedSurah?.number ? String(selectedSurah.number) : ""}
        onValueChange={(value) => {
          const n = parseInt(value, 10);
          const surah = surahs.find((s) => s.number === n);
          if (surah) onSelect(surah);
        }}
      >
        <SelectTrigger className="w-full bg-background/50 border-islamic-gold/20">
          <SelectValue
            placeholder={t("ui.selectSurah", { defaultValue: "Select a surah" })}
          />
        </SelectTrigger>

        {/* IMPORTANT: no ScrollArea inside SelectContent */}
        <SelectContent className="max-h-[320px] overflow-y-auto">
          {filteredSurahs.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t("ui.noResults", { defaultValue: "No results" })}
            </div>
          ) : (
            filteredSurahs.map((surah) => (
              <SelectItem
                key={surah.number}
                value={String(surah.number)}
                className="py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="min-w-8 text-sm font-semibold text-foreground">
                    {surah.number}.
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg leading-none" style={{ fontFamily: "serif" }}>
                        {surah.name}
                      </span>
                      <span className="font-medium text-foreground truncate">
                        {surah.englishName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground truncate">
                        {surah.englishTranslation}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("ui.versesCountShort", {
                          count: surah.ayahs,
                          defaultValue: "{{count}} verses",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SurahSelector;