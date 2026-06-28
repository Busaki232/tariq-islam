import {
  PrayerTimes,
  Coordinates,
  CalculationMethod,
  Madhab,
} from "adhan";

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export function computePrayerTimes(params: {
  lat: number;
  lng: number;
  date?: Date;
  method?: keyof typeof CalculationMethod;
  madhab?: "shafi" | "hanafi";
}) {
  const {
    lat,
    lng,
    date = new Date(),
    method = "MuslimWorldLeague",
    madhab = "shafi",
  } = params;

  const coords = new Coordinates(lat, lng);

  const calcMethod = (CalculationMethod as any)[method] || CalculationMethod.MuslimWorldLeague;
  const m = calcMethod();
  m.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;

  const pt = new PrayerTimes(coords, date, m);

  return {
    fajr: pt.fajr,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  } as Record<PrayerKey, Date>;
}