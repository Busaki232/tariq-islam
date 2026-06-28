// src/adhan/adhanNotifications.ts
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import * as adhan from "adhan";

/**
 * Storage key for Adhan settings
 */
const ADHAN_SETTINGS_KEY = "adhan_settings";

/**
 * Android channel id for Adhan
 * Android will NOT update an existing channel's sound after creation.
 * If you change sound, bump this id AND reinstall (or at least clear app data).
 */
const ANDROID_ADHAN_CHANNEL_ID = "adhan_v4";

/**
 * Stable IDs for cancellation and scheduling
 * Reserve enough IDs for today + tomorrow (10 prayers max), plus a little buffer.
 */
const ADHAN_ID_BASE = 5000; // 5000-5024 reserved
const ADHAN_ID_COUNT = 25;

const TEST_ID_1MIN = 5999;
const TEST_ID_INSTANT = 6001;

type PrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type AdhanMethod =
  | "MWL"
  | "ISNA"
  | "Egypt"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "Kuwait"
  | "Qatar"
  | "Singapore";

export type AdhanMadhab = "shafi" | "hanafi";

/**
 * Shape of settings stored on device (Option 1)
 */
export type AdhanSettings = {
  enabled: boolean;

  method?: AdhanMethod;
  madhab?: AdhanMadhab;

  locationMode?: "device" | "manual";
  lat?: number;
  lng?: number;

  offsets?: Partial<Record<"fajr" | "dhuhr" | "asr" | "maghrib" | "isha", number>>;

  prayersEnabled?: Partial<Record<"fajr" | "dhuhr" | "asr" | "maghrib" | "isha", boolean>>;
};

const DEFAULT_SETTINGS: AdhanSettings = {
  enabled: false,
  method: "MWL",
  madhab: "shafi",
  locationMode: "device",
  offsets: {},
  prayersEnabled: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
};

export function loadAdhanSettings(): AdhanSettings {
  try {
    const raw = localStorage.getItem(ADHAN_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAdhanSettings(settings: AdhanSettings) {
  try {
    localStorage.setItem(ADHAN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

async function ensureAndroidAdhanChannel() {
  if (Capacitor.getPlatform() !== "android") return;

  try {
    await LocalNotifications.createChannel({
      id: ANDROID_ADHAN_CHANNEL_ID,
      name: "Adhan",
      description: "Adhan prayer time alerts",
      importance: 5,
      visibility: 1,
      sound: "adhan",
      vibration: true,
      lights: true,
    });
  } catch {
    // ignore
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;

    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

async function getCoordinates(s: AdhanSettings): Promise<{ lat: number; lng: number } | null> {
  if (s.locationMode === "manual") {
    if (typeof s.lat === "number" && typeof s.lng === "number") return { lat: s.lat, lng: s.lng };
    return null;
  }

  try {
    const perms = await Geolocation.requestPermissions();
    const ok = perms.location === "granted" || perms.coarseLocation === "granted";
    if (!ok) return null;

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
    });

    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

function getCalculationParameters(method: AdhanMethod) {
  switch (method) {
    case "ISNA":
      return adhan.CalculationMethod.NorthAmerica();
    case "Egypt":
      return adhan.CalculationMethod.Egyptian();
    case "Karachi":
      return adhan.CalculationMethod.Karachi();
    case "UmmAlQura":
      return adhan.CalculationMethod.UmmAlQura();
    case "Dubai":
      return adhan.CalculationMethod.Dubai();
    case "Kuwait":
      return adhan.CalculationMethod.Kuwait();
    case "Qatar":
      return adhan.CalculationMethod.Qatar();
    case "Singapore":
      return adhan.CalculationMethod.Singapore();
    case "MWL":
    default:
      return adhan.CalculationMethod.MuslimWorldLeague();
  }
}

function applyMadhab(params: any, madhab: AdhanMadhab) {
  params.madhab = madhab === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  return params;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}

function titleCasePrayer(p: PrayerKey) {
  return p;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Compute prayer times for a specific calendar date (important for tomorrow scheduling)
 */
function computePrayerTimesForDate(
  date: Date,
  lat: number,
  lng: number,
  s: AdhanSettings
): { prayer: PrayerKey; at: Date }[] {
  const coords = new adhan.Coordinates(lat, lng);

  const method = (s.method ?? "MWL") as AdhanMethod;
  const madhab = (s.madhab ?? "shafi") as AdhanMadhab;

  let params = getCalculationParameters(method);
  params = applyMadhab(params, madhab);

  const pt = new adhan.PrayerTimes(coords, date, params);

  const base: Record<PrayerKey, Date> = {
    Fajr: pt.fajr,
    Dhuhr: pt.dhuhr,
    Asr: pt.asr,
    Maghrib: pt.maghrib,
    Isha: pt.isha,
  };

  const offsets = s.offsets ?? {};
  const enabled = s.prayersEnabled ?? {};

  const out: { prayer: PrayerKey; at: Date }[] = [];

  const pushIfEnabled = (prayer: PrayerKey, key: keyof typeof offsets) => {
    if (enabled[key] === false) return;
    const off = offsets[key] ?? 0;
    out.push({ prayer, at: addMinutes(base[prayer], off) });
  };

  pushIfEnabled("Fajr", "fajr");
  pushIfEnabled("Dhuhr", "dhuhr");
  pushIfEnabled("Asr", "asr");
  pushIfEnabled("Maghrib", "maghrib");
  pushIfEnabled("Isha", "isha");

  return out;
}

export async function cancelAdhanNotifications() {
  try {
    const ids: number[] = [];
    for (let i = 0; i < ADHAN_ID_COUNT; i++) ids.push(ADHAN_ID_BASE + i);
    ids.push(TEST_ID_1MIN, TEST_ID_INSTANT);

    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // ignore
  }
}

export async function getPendingNotifications() {
  try {
    return await LocalNotifications.getPending();
  } catch {
    return { notifications: [] as any[] };
  }
}

export async function fireAdhanInstantTest() {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await ensureAndroidAdhanChannel();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID_INSTANT,
        title: "Adhan (Instant Test)",
        body: "If you see this, LocalNotifications works.",
        schedule: { at: new Date(Date.now() + 10_000), allowWhileIdle: true },
        channelId: ANDROID_ADHAN_CHANNEL_ID,
        sound: Capacitor.getPlatform() === "ios" ? "default" : undefined,
        extra: { type: "adhan", prayer: "InstantTest" },
      },
    ],
  });
}

/**
 * Schedule Adhan notifications for the next N days (default 2: today + tomorrow)
 * This fixes:
 * - Only 3 prayers firing (because you enabled after some prayers already passed)
 * - Having to re-set every day (because tomorrow was never scheduled)
 */
export async function scheduleAdhanForNextDays(daysToSchedule = 2, settings?: AdhanSettings) {
  const s = settings ?? loadAdhanSettings();
  if (!s.enabled) return;

  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await ensureAndroidAdhanChannel();
  await cancelAdhanNotifications();

  const coords = await getCoordinates(s);
  if (!coords) return;

  const now = new Date();
  const todayStart = startOfDay(now);

  const allTimes: { prayer: PrayerKey; at: Date }[] = [];

  for (let i = 0; i < daysToSchedule; i++) {
    const day = addDays(todayStart, i);
    allTimes.push(...computePrayerTimesForDate(day, coords.lat, coords.lng, s));
  }

  const future = allTimes
    .filter((x) => x.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const notifications = future.slice(0, ADHAN_ID_COUNT).map((x, index) => ({
    id: ADHAN_ID_BASE + index,
    title: "Adhan",
    body: `Time for ${titleCasePrayer(x.prayer)} prayer`,
    schedule: { at: x.at, allowWhileIdle: true },
    channelId: ANDROID_ADHAN_CHANNEL_ID,
    sound: Capacitor.getPlatform() === "ios" ? "default" : undefined,
    extra: { type: "adhan", prayer: x.prayer, lat: coords.lat, lng: coords.lng },
  }));

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

/**
 * Backward compatible wrapper (keeps your existing call sites)
 * Previously scheduled only today. Now schedules today + tomorrow.
 */
export async function scheduleAdhanForToday(settings?: AdhanSettings) {
  return await scheduleAdhanForNextDays(2, settings);
}

export async function scheduleAdhanTestInOneMinute() {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await ensureAndroidAdhanChannel();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID_1MIN,
        title: "Adhan (Test)",
        body: "This is a test Adhan notification",
        schedule: { at: new Date(Date.now() + 60_000), allowWhileIdle: true },
        channelId: ANDROID_ADHAN_CHANNEL_ID,
        sound: Capacitor.getPlatform() === "ios" ? "default" : undefined,
        extra: { type: "adhan", prayer: "Test" },
      },
    ],
  });
}