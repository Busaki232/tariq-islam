import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Star } from "lucide-react";
import { useIslamicCalendar, HIJRI_MONTHS } from "@/hooks/useIslamicCalendar";
import { useTranslation } from "react-i18next";

function normalizeHolidayKey(name: string) {
  const n = (name || "").toLowerCase().trim();
  return n
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const HIJRI_MONTH_KEYS = [
  "muharram",
  "safar",
  "rabiAlAwwal",
  "rabiAlThani",
  "jumadaAlUla",
  "jumadaAlAkhirah",
  "rajab",
  "shaban",
  "ramadan",
  "shawwal",
  "dhuAlQidah",
  "dhuAlHijjah",
];

export const IslamicCalendar = () => {
  const { t, i18n } = useTranslation("features");
  const lang = (i18n.resolvedLanguage || i18n.language || "en").toLowerCase();
  const isArabic = lang.startsWith("ar");
  const isEnglish = lang.startsWith("en");

  const {
    currentDate,
    hijriDate,
    holidays,
    upcomingHolidays,
    loading,
    getHolidayForDate,
  } = useIslamicCalendar();

  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedYear, setSelectedYear] = useState(1446);

  useEffect(() => {
    if (hijriDate) {
      setSelectedMonth(hijriDate.month);
      setSelectedYear(hijriDate.year);
    }
  }, [hijriDate]);

  // Support both key layouts:
  // - features.islamicCalendar.*
  // - features.journey.islamicCalendar.*
  const k = (suffix: string) => {
    const direct = `islamicCalendar.${suffix}`;
    const nested = `journey.islamicCalendar.${suffix}`;
    return i18n.exists(`features:${direct}`) ? direct : nested;
  };

  const dayHeaders = useMemo(() => {
    const val = t(k("dayHeaders"), { returnObjects: true }) as unknown;
    const arr = Array.isArray(val) ? (val as string[]) : [];
    return arr.length === 7 ? arr : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }, [t, i18n]);

  const fmtGregorian = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
    } catch {
      return new Intl.DateTimeFormat("en", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
    }
  }, [lang]);

  const getMonthArabic = (monthIndex1to12: number) =>
    HIJRI_MONTHS[monthIndex1to12 - 1]?.arabic || "";

  const getMonthLocalized = (monthIndex1to12: number) => {
    const key = HIJRI_MONTH_KEYS[monthIndex1to12 - 1];
    const i18nKey = `${k("months")}.${key}`;

    // Prefer translation. If missing:
    // - non-English: show Arabic month (avoids English dominance)
    // - English: show existing English from HIJRI_MONTHS
    if (!i18n.exists(`features:${i18nKey}`)) {
      return isEnglish ? (HIJRI_MONTHS[monthIndex1to12 - 1]?.english || "") : getMonthArabic(monthIndex1to12);
    }
    return t(i18nKey);
  };

  const getHolidayName = (holiday: { name: string; name_arabic?: string }) => {
    if (isArabic && holiday.name_arabic) return holiday.name_arabic;

    const hk = normalizeHolidayKey(holiday.name);
    const base = `${k("holidays")}.${hk}`;

    // Support both:
    // holidays.<key>.name  OR  holidays.<key> (string)
    if (i18n.exists(`features:${base}.name`)) return t(`${base}.name`);
    if (i18n.exists(`features:${base}`)) return t(base);

    // Avoid English dominance for non-English locales
    return isEnglish ? holiday.name : (holiday.name_arabic || "");
  };

  const getHolidayDescription = (holiday: { name: string; description?: string }) => {
    const hk = normalizeHolidayKey(holiday.name);
    const base = `${k("holidays")}.${hk}.description`;

    // Only show DB English description if the UI language is English.
    if (i18n.exists(`features:${base}`)) return t(base);
    return isEnglish ? (holiday.description || "") : "";
  };

  const getHolidaySignificance = (holiday: { name: string; significance?: string }) => {
    const hk = normalizeHolidayKey(holiday.name);
    const base = `${k("holidays")}.${hk}.significance`;

    if (i18n.exists(`features:${base}`)) return t(base);
    return isEnglish ? (holiday.significance || "") : "";
  };

  if (loading || !hijriDate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setSelectedMonth(hijriDate.month);
    setSelectedYear(hijriDate.year);
  };

  const calendarDays = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Current Date Display */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-5 w-5" />
            <span>{fmtGregorian.format(currentDate)}</span>
          </div>

          <div className="text-3xl font-bold text-primary" dir="rtl">
            {hijriDate.day} {getMonthArabic(hijriDate.month)} {hijriDate.year}
          </div>

          <div className="text-xl text-foreground">
            {getMonthLocalized(hijriDate.month)} {hijriDate.day}, {hijriDate.year}{" "}
            {t(k("ah"))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Calendar View */}
        <Card className="md:col-span-2 p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button onClick={handlePreviousMonth} variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <div className="text-lg font-bold" dir="rtl">
                {getMonthArabic(selectedMonth)}
              </div>
              <div className="text-sm text-muted-foreground">
                {getMonthLocalized(selectedMonth)} {selectedYear} {t(k("ah"))}
              </div>
            </div>

            <Button onClick={handleNextMonth} variant="outline" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-center mb-4">
            <Button onClick={handleToday} variant="outline" size="sm">
              {t(k("today"))}
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {dayHeaders.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day) => {
              const holiday = getHolidayForDate(selectedMonth, day);
              const isToday =
                selectedMonth === hijriDate.month &&
                day === hijriDate.day &&
                selectedYear === hijriDate.year;

              const isFriday = day % 7 === 6;

              const holidayTitle = holiday ? getHolidayName(holiday) : "";
              const showStar = !!holidayTitle;

              return (
                <button
                  key={day}
                  className={`
                    aspect-square p-2 rounded-lg text-sm font-medium
                    transition-all hover:bg-accent hover:scale-105
                    ${isToday ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                    ${isFriday && !isToday ? "bg-accent text-accent-foreground" : ""}
                    ${showStar ? "ring-2 ring-primary ring-offset-2" : ""}
                  `}
                  title={holidayTitle || undefined}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{day}</span>
                    {showStar && <Star className="h-3 w-3 fill-primary text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Upcoming Holidays Sidebar */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {t(k("upcomingEvents"))}
          </h3>

          <div className="space-y-4">
            {upcomingHolidays.length > 0 ? (
              upcomingHolidays.map((holiday) => {
                const name = getHolidayName(holiday);
                if (!name) return null;

                const desc = getHolidayDescription(holiday);

                return (
                  <div key={holiday.id} className="space-y-2 pb-4 border-b last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{name}</div>
                      {holiday.is_major_holiday && (
                        <Badge variant="default" className="text-xs">
                          {t(k("major"))}
                        </Badge>
                      )}
                    </div>

                    {isArabic && holiday.name_arabic && (
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {holiday.name_arabic}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {getMonthLocalized(holiday.hijri_month)} {holiday.hijri_day}
                    </div>

                    {!!desc && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t(k("noUpcoming"))}
              </p>
            )}
          </div>

          {/* All Holidays Link */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium text-sm mb-3">{t(k("allHolidays"))}</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {holidays.map((holiday) => {
                const name = getHolidayName(holiday);
                if (!name) return null;

                return (
                  <div key={holiday.id} className="text-xs flex items-center justify-between gap-2 py-1">
                    <span className="truncate">{name}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {holiday.hijri_month}/{holiday.hijri_day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Holiday Details Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {holidays
          .filter((h) => h.is_major_holiday)
          .map((holiday) => {
            const name = getHolidayName(holiday);
            if (!name) return null;

            const desc = getHolidayDescription(holiday);
            const sig = getHolidaySignificance(holiday);

            return (
              <Card key={holiday.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">{name}</h4>
                    <Star className="h-4 w-4 text-primary fill-primary" />
                  </div>

                  {isArabic && holiday.name_arabic && (
                    <p className="text-sm text-muted-foreground" dir="rtl">
                      {holiday.name_arabic}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {getMonthLocalized(holiday.hijri_month)} {holiday.hijri_day}
                  </div>

                  {!!desc && <p className="text-sm">{desc}</p>}
                  {!!sig && <p className="text-xs text-muted-foreground italic">{sig}</p>}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
};