import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import { computePrayerTimes, PrayerKey } from "@/utils/prayerTimes";

const STORAGE_KEY = "adhan_settings_v1";

// Keep IDs stable so cancel works cleanly
const NOTIF_IDS: Record<PrayerKey, number> = {
  fajr: 9101,
  dhuhr: 9102,
  asr: 9103,
  maghrib: 9104,
  isha: 9105,
};

export type AdhanSettings = {
  enabled: boolean;
  minutesBefore: number; // 0, 5, 10, 15
  prayers: Record<PrayerKey, boolean>;
  method: "MuslimWorldLeague" | "NorthAmerica" | "Egyptian" | "UmmAlQura" | "Karachi";
  madhab: "shafi" | "hanafi";
};

export const DEFAULT_ADHAN_SETTINGS: AdhanSettings = {
  enabled: false,
  minutesBefore: 10,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  method: "MuslimWorldLeague",
  madhab: "shafi",
};

export function loadAdhanSettings(): AdhanSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADHAN_SETTINGS;
    return { ...DEFAULT_ADHAN_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADHAN_SETTINGS;
  }
}

export function saveAdhanSettings(s: AdhanSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function subtractMinutes(d: Date, mins: number) {
  return new Date(d.getTime() - mins * 60 * 1000);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === "granted") return true;

  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

export async function cancelAdhanNotifications() {
  const ids = Object.values(NOTIF_IDS);
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
}

export async function scheduleAdhanForToday(settings: AdhanSettings) {
  // Always reset first to prevent duplicates
  await cancelAdhanNotifications();

  const ok = await ensureNotificationPermission();
  if (!ok) return;

  // Get location
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  const times = computePrayerTimes({
    lat,
    lng,
    date: new Date(),
    method:
      settings.method === "NorthAmerica"
        ? "NorthAmerica"
        : settings.method === "Egyptian"
        ? "Egyptian"
        : settings.method === "UmmAlQura"
        ? "UmmAlQura"
        : settings.method === "Karachi"
        ? "Karachi"
        : "MuslimWorldLeague",
    madhab: settings.madhab,
  });

  const now = new Date();

  const toNotify: Array<{ id: number; title: string; body: string; at: Date }> = [];

  (Object.keys(times) as PrayerKey[]).forEach((k) => {
    if (!settings.prayers[k]) return;

    const at = subtractMinutes(times[k], settings.minutesBefore);
    if (at <= now) return; // don’t schedule past notifications

    const title = "Prayer time";
    const body =
      settings.minutesBefore > 0
        ? `${k.toUpperCase()} in ${settings.minutesBefore} minutes`
        : `${k.toUpperCase()} is now`;

    toNotify.push({ id: NOTIF_IDS[k], title, body, at });
  });

  if (toNotify.length === 0) return;

  await LocalNotifications.schedule({
    notifications: toNotify.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: { at: n.at },
    })),
  });
}