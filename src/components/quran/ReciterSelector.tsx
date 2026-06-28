// src/components/quran/ReciterSelector.tsx
import { useTranslation } from "react-i18next";
import { Reciter } from "@/data/quranData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReciterSelectorProps {
  reciters: Reciter[];
  selectedReciter: Reciter;
  onChange: (reciter: Reciter) => void;
}

export default function ReciterSelector({
  reciters,
  selectedReciter,
  onChange,
}: ReciterSelectorProps) {
  const { t } = useTranslation("quran");

  return (
    <Select
      value={selectedReciter?.id}
      onValueChange={(value) => {
        const reciter = reciters.find((r) => r.id === value);
        if (reciter) onChange(reciter);
      }}
    >
      <SelectTrigger className="w-full bg-background/50 border-islamic-gold/20">
        <SelectValue
          placeholder={t("ui.selectReciter", {
            defaultValue: "Select Reciter",
          })}
        />
      </SelectTrigger>

      <SelectContent className="max-h-[320px] overflow-y-auto">
        {reciters.map((reciter) => (
          <SelectItem key={reciter.id} value={reciter.id}>
            {reciter.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}