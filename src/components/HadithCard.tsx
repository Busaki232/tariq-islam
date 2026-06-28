import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { BookOpen } from "lucide-react";

interface HadithCardProps {
  arabicText: string;
  englishText: string;
  narrator: string;
  book: string;
  reference: string;
  grade?: string;
}

export const HadithCard = ({
  arabicText,
  englishText,
  narrator,
  book,
  reference,
  grade
}: HadithCardProps) => {
  return (
    <Card className="overflow-hidden border-islamic-green/20 bg-gradient-to-br from-background to-amber-500/5">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm">Hadith</span>
          </div>
          {grade && (
            <Badge variant="secondary" className="text-xs">
              {grade}
            </Badge>
          )}
        </div>

        {/* Arabic Text */}
        {arabicText && (
          <div className="text-right" dir="rtl">
            <p className="text-lg leading-relaxed font-arabic text-foreground">
              {arabicText}
            </p>
          </div>
        )}

        {/* English Translation */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-sm text-foreground leading-relaxed">
            {englishText}
          </p>
        </div>

        {/* Reference */}
        <div className="pt-2 space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Narrator:</span> {narrator}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Reference:</span> {book} - {reference}
          </p>
        </div>
      </div>
    </Card>
  );
};
