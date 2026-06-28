import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import i18n from "@/i18n/config";

// Hijri month names (arabic + i18n key)
// No hardcoded English strings here anymore.
export const HIJRI_MONTHS = [
  { arabic: "محرم", key: "islamicCalendar.months.muharram" },
  { arabic: "صفر", key: "islamicCalendar.months.safar" },
  { arabic: "ربيع الأول", key: "islamicCalendar.months.rabiAlAwwal" },
  { arabic: "ربيع الثاني", key: "islamicCalendar.months.rabiAlThani" },
  { arabic: "جمادى الأولى", key: "islamicCalendar.months.jumadaAlUla" },
  { arabic: "جمادى الآخرة", key: "islamicCalendar.months.jumadaAlAkhirah" },
  { arabic: "رجب", key: "islamicCalendar.months.rajab" },
  { arabic: "شعبان", key: "islamicCalendar.months.shaban" },
  { arabic: "رمضان", key: "islamicCalendar.months.ramadan" },
  { arabic: "شوال", key: "islamicCalendar.months.shawwal" },
  { arabic: "ذو القعدة", key: "islamicCalendar.months.dhuAlQidah" },
  { arabic: "ذو الحجة", key: "islamicCalendar.months.dhuAlHijjah" },
] as const;

interface IslamicHoliday {
  id: string;
  name: string;
  name_arabic: string;
  hijri_month: number;
  hijri_day: number;
  description: string;
  significance: string;
  is_major_holiday: boolean;
}

interface HijriDate {
  year: number;
  month: number;
  day: number;
}

// Simple Hijri date calculation (approximation)
export const gregorianToHijri = (date: Date): HijriDate => {
  const islamicEpoch = new Date(622, 6, 16).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  const daysSinceEpoch = Math.floor((date.getTime() - islamicEpoch) / msPerDay);

  const lunarYearLength = 354.367;
  const year = Math.floor(daysSinceEpoch / lunarYearLength) + 1;

  const daysIntoYear = daysSinceEpoch % lunarYearLength;

  const lunarMonthLength = 29.53;
  const month = Math.floor(daysIntoYear / lunarMonthLength) + 1;
  const day = Math.floor(daysIntoYear % lunarMonthLength) + 1;

  return {
    year,
    month: Math.min(month, 12),
    day: Math.min(day, 30),
  };
};

function isArabicLang(lng?: string) {
  const v = (lng || i18n.resolvedLanguage || i18n.language || "en").toLowerCase();
  return v.startsWith("ar");
}

// Month display helper: returns the correct string for the current language
export function getHijriMonthLabel(month1to12: number, lng?: string) {
  const idx = Math.max(1, Math.min(12, month1to12)) - 1;
  const m = HIJRI_MONTHS[idx];
  const rtl = isArabicLang(lng);

  // Arabic UI -> show Arabic month names
  if (rtl) return m.arabic;

  // Non-Arabic UI -> use i18n key (fallback to Arabic if missing)
  return i18n.t(m.key, { defaultValue: m.arabic });
}

// Holiday display helper: chooses Arabic name when Arabic UI
export function getHolidayDisplayName(holiday: IslamicHoliday, lng?: string) {
  if (isArabicLang(lng)) return holiday.name_arabic || holiday.name;
  return holiday.name || holiday.name_arabic;
}

export const useIslamicCalendar = () => {
  const [currentDate] = useState(new Date());
  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);
  const [holidays, setHolidays] = useState<IslamicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hijri = gregorianToHijri(currentDate);
    setHijriDate(hijri);

    const fetchHolidays = async () => {
      try {
        const { data, error } = await supabase
          .from("islamic_holidays")
          .select("*")
          .order("hijri_month", { ascending: true })
          .order("hijri_day", { ascending: true });

        if (error) throw error;
        setHolidays((data || []) as IslamicHoliday[]);
      } catch (error) {
        logger.error("Error fetching Islamic holidays", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [currentDate]);

  const upcomingHolidays = useMemo(() => {
    if (!hijriDate) return [];

    return holidays
      .filter((holiday) => {
        const monthDiff = holiday.hijri_month - hijriDate.month;
        const dayDiff = holiday.hijri_day - hijriDate.day;

        if (monthDiff === 0 && dayDiff >= 0) return true;
        if (monthDiff === 1 || (monthDiff === -11 && hijriDate.month === 12)) return true;

        return false;
      })
      .slice(0, 5);
  }, [holidays, hijriDate]);

  const getHolidayForDate = (month: number, day: number) => {
    return holidays.find((h) => h.hijri_month === month && h.hijri_day === day);
  };

  return {
    currentDate,
    hijriDate,
    holidays,
    upcomingHolidays,
    loading,
    getHolidayForDate,

    // New helpers you can use in UI
    getHijriMonthLabel,
    getHolidayDisplayName,
  };
};