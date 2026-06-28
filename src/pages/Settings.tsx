// src/pages/Settings.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

import { useTranslation } from "react-i18next";
import i18n from "@/i18n/config";
import { useNavigate } from "react-router-dom";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  loadAdhanSettings,
  saveAdhanSettings,
  scheduleAdhanForToday,
  cancelAdhanNotifications,
  fireAdhanInstantTest,
} from "@/adhan/adhanNotifications";
import { scheduleAdhanForNextDays } from "@/adhan/adhanNotifications";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type BlockedRow = {
  id: string;
  blocked_id: string;
  created_at: string;
};

const ONLINE_HIDE_KEY = "ti_hide_online_status";
const ADHAN_ENABLED_KEY = "settings_adhan_enabled";
const DELETE_ACCOUNT_URL = "https://global-muslims-connect.com/delete-account";

const SUPPORTED_LANGS = [
  { code: "en" },
  { code: "fr" },
  { code: "ha" },
  { code: "ar" },
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number]["code"];

function getBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function setBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

async function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

function normalizeToSupported(code: string): SupportedLang {
  const c = (code || "").toLowerCase();
  if (c.startsWith("fr")) return "fr";
  if (c.startsWith("ha")) return "ha";
  if (c.startsWith("ar")) return "ar";
  return "en";
}

function getInitialLanguage(): SupportedLang {
  try {
    const saved =
      localStorage.getItem("app_language") ||
      localStorage.getItem("i18nextLng") ||
      "";
    return normalizeToSupported(saved);
  } catch {
    return "en";
  }
}

function normalizeUsername(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  const noAt = v.startsWith("@") ? v.slice(1) : v;
  return noAt.trim().toLowerCase();
}

function isValidUsername(u: string) {
  if (!u) return false;
  if (u.length < 3 || u.length > 20) return false;
  if (!/^[a-z0-9._]+$/.test(u)) return false;
  return true;
}

function safeNum(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function persistLocationModeExclusive(nextMode: "device" | "manual") {
  const s: any = loadAdhanSettings() || {};
  const next: any = { ...s, locationMode: nextMode };

  if (nextMode === "device") {
    next.manualLat = undefined;
    next.manualLng = undefined;
  } else {
    next.deviceLat = undefined;
    next.deviceLng = undefined;
  }

  saveAdhanSettings(next);
  return next;
}

async function getNativeLocationPermissionState() {
  try {
    const perm = await Geolocation.checkPermissions();
    return perm.location;
  } catch {
    return "prompt";
  }
}

function pickActiveCoords(s: any): { lat: number; lng: number } | null {
  const mode = s?.locationMode === "manual" ? "manual" : "device";
  if (mode === "manual") {
    const lat = safeNum(s?.manualLat);
    const lng = safeNum(s?.manualLng);
    if (lat != null && lng != null) return { lat, lng };
    return null;
  }
  const lat = safeNum(s?.deviceLat);
  const lng = safeNum(s?.deviceLng);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}
const LanguageSection = () => {
  const { t } = useTranslation();


  const lang = normalizeToSupported(
    i18n.resolvedLanguage || i18n.language || "en"
  );

  const currentLabel =
    lang === "en"
      ? t("settings.language.english")
      : lang === "fr"
        ? t("settings.language.french")
        : lang === "ha"
          ? t("settings.language.hausa")
          : t("settings.language.arabic");

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="text-base font-semibold">
          {t("settings.language.title")}
        </div>

        <div className="text-sm text-muted-foreground">
          {t("settings.language.subtitle")}
        </div>

        <div className="mt-3">
          <Select
            value={lang}
            onValueChange={(v) => {
              const next = normalizeToSupported(String(v));
              try {
                localStorage.setItem("i18nextLng", next);
                localStorage.setItem("app_language", next);
              } catch {
                // ignore
              }
              void i18n.changeLanguage(next);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("settings.language.placeholder")} />
            </SelectTrigger>

            <SelectContent>
              {SUPPORTED_LANGS.map((l) => {
                const label =
                  l.code === "en"
                    ? t("settings.language.english")
                    : l.code === "fr"
                      ? t("settings.language.french")
                      : l.code === "ha"
                        ? t("settings.language.hausa")
                        : t("settings.language.arabic");

                return (
                  <SelectItem key={l.code} value={l.code}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {t("settings.language.current")}: {currentLabel}
        </div>
      </div>
    </div>
  );
};

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

const doSignOut = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.log("[Settings] signOut failed, forcing logout:", e);
  } finally {
    localStorage.removeItem("sb-enevjiodbmngnkwkwuud-auth-token");
    sessionStorage.clear();
    window.location.replace("/");
  }
};

  useEffect(() => {
    const saved = getInitialLanguage();
    const current = normalizeToSupported(i18n.resolvedLanguage || i18n.language || "en");
    if (current !== saved) void i18n.changeLanguage(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [messageNotifs, setMessageNotifs] = useState(() =>
    getBool("settings_msg_notifs", true)
  );
  const [callNotifs, setCallNotifs] = useState(() =>
    getBool("settings_call_notifs", true)
  );

  const [adhanEnabled, setAdhanEnabled] = useState<boolean>(() =>
    getBool(ADHAN_ENABLED_KEY, false)
  );

  const [adhanLocationMode, setAdhanLocationMode] = useState<"device" | "manual">(() => {
    const s: any = loadAdhanSettings();
    return s?.locationMode === "manual" ? "manual" : "device";
  });

  const [manualLat, setManualLat] = useState<string>(() => {
    const s: any = loadAdhanSettings();
    return typeof s?.manualLat === "number" ? String(s.manualLat) : "";
  });

  const [manualLng, setManualLng] = useState<string>(() => {
    const s: any = loadAdhanSettings();
    return typeof s?.manualLng === "number" ? String(s.manualLng) : "";
  });

  const [savedManualCoords, setSavedManualCoords] = useState<{ lat: number | null; lng: number | null }>(() => {
    const s: any = loadAdhanSettings();
    return { lat: safeNum(s?.manualLat), lng: safeNum(s?.manualLng) };
  });

  const [savedDeviceCoords, setSavedDeviceCoords] = useState<{ lat: number | null; lng: number | null }>(() => {
    const s: any = loadAdhanSettings();
    return { lat: safeNum(s?.deviceLat), lng: safeNum(s?.deviceLng) };
  });

  const [locationSavedAt, setLocationSavedAt] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!locationSavedAt) return;
    const id = window.setTimeout(() => setLocationSavedAt(null), 2000);
    return () => window.clearTimeout(id);
  }, [locationSavedAt]);

  const parsedLat = Number(manualLat);
  const parsedLng = Number(manualLng);
  const coordsValid = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  const manualCoordsDirty =
    coordsValid &&
    (savedManualCoords.lat == null ||
      savedManualCoords.lng == null ||
      Math.abs(parsedLat - savedManualCoords.lat) > 0.000001 ||
      Math.abs(parsedLng - savedManualCoords.lng) > 0.000001);

  const [hideOnline, setHideOnline] = useState<boolean>(() =>
    getBool(ONLINE_HIDE_KEY, false)
  );

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [usernameSavedAt, setUsernameSavedAt] = useState<number | null>(null);
  const lastSavedUsernameRef = useRef<string>("");

  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, ProfileRow>>({});
  const [blockedLoading, setBlockedLoading] = useState(false);

  useEffect(() => setBool("settings_msg_notifs", messageNotifs), [messageNotifs]);
  useEffect(() => setBool("settings_call_notifs", callNotifs), [callNotifs]);
  useEffect(() => setBool(ADHAN_ENABLED_KEY, adhanEnabled), [adhanEnabled]);
  useEffect(() => setBool(ONLINE_HIDE_KEY, hideOnline), [hideOnline]);

  useEffect(() => {
    const s: any = loadAdhanSettings() || {};

    setAdhanLocationMode(s?.locationMode === "manual" ? "manual" : "device");
    setSavedManualCoords({ lat: safeNum(s?.manualLat), lng: safeNum(s?.manualLng) });
    setSavedDeviceCoords({ lat: safeNum(s?.deviceLat), lng: safeNum(s?.deviceLng) });

    const run = async () => {
      if (!Capacitor.isNativePlatform()) return;

      const mode = s?.locationMode === "manual" ? "manual" : "device";
      if (mode !== "device") return;

      const state = await getNativeLocationPermissionState();
      if (state === "denied") {
        const next = persistLocationModeExclusive("manual");
        setAdhanLocationMode("manual");
        setSavedDeviceCoords({ lat: null, lng: null });

        toast({
          title: t("settings.permission_needed"),
          description: t("settings.permission_needed_desc"),
        });

        const active = pickActiveCoords(next);
        if (adhanEnabled && next?.enabled && active) {
          void scheduleAdhanForToday(next);
        }
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s: any = loadAdhanSettings() || {};
    if (!adhanEnabled || !s?.enabled) return;

    const active = pickActiveCoords(s);
    if (active) {
      void scheduleAdhanForNextDays(7, s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!usernameSavedAt) return;
    const id = window.setTimeout(() => setUsernameSavedAt(null), 2500);
    return () => window.clearTimeout(id);
  }, [usernameSavedAt]);

  const onlineLabel = useMemo(() => {
    return hideOnline ? t("settings.online_hidden") : t("settings.online_visible");
  }, [hideOnline, t]);

  const displayName = useMemo(() => {
    if (!profile) return t("settings.profile_title");
    const fn = profile.full_name?.trim();
    const un = profile.username?.trim();
    if (fn) return fn;
    if (un) return `@${un}`;
    return t("settings.profile_title");
  }, [profile, t]);

  const emailText = useMemo(() => user?.email || "", [user?.email]);

  function openDeleteAccountPage() {
    const url = (DELETE_ACCOUNT_URL || "").trim();
    if (!url) return;

    if (Capacitor.isNativePlatform()) {
      window.open(url, "_blank");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadProfile() {
    if (!user?.id) return;

    setProfileLoading(true);
    try {
      const res = await withTimeout(
        supabase
          .from("profiles")
          .select("user_id, full_name, username, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle(),
        12000
      );

      const { data, error } = res as any;
      if (error) throw error;

      const nextProfile: ProfileRow = {
        user_id: user.id,
        full_name: data?.full_name ?? null,
        username: data?.username ?? null,
        avatar_url: data?.avatar_url ?? null,
      };

      setProfile(nextProfile);

      const currentDbUsername = (nextProfile.username || "").trim().toLowerCase();
      lastSavedUsernameRef.current = currentDbUsername;
      setUsernameDraft(currentDbUsername ? `@${currentDbUsername}` : "");
      setUsernameSavedAt(null);
    } catch (e) {
      console.log("[Settings] loadProfile failed:", e);
      const fallback: ProfileRow = {
        user_id: user?.id || "",
        full_name: null,
        username: null,
        avatar_url: null,
      };
      setProfile(fallback);
      lastSavedUsernameRef.current = "";
      setUsernameDraft("");
      setUsernameSavedAt(null);
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadBlockedUsers() {
    if (!user?.id) return;

    setBlockedLoading(true);
    try {
      const res = await withTimeout(
        supabase
          .from("blocked_users")
          .select("id, blocked_id, created_at")
          .eq("blocker_id", user.id)
          .order("created_at", { ascending: false }),
        12000
      );

      const { data, error } = res as any;
      if (error) throw error;

      const rows = (data ?? []) as BlockedRow[];
      setBlocked(rows);

      const ids = rows.map((r) => r.blocked_id);
      if (ids.length === 0) {
        setBlockedProfiles({});
        return;
      }

      const profRes = await withTimeout(
        supabase
          .from("profiles")
          .select("user_id, full_name, username, avatar_url")
          .in("user_id", ids),
        12000
      );

      const { data: profs, error: profErr } = profRes as any;
      if (profErr) throw profErr;

      const map: Record<string, ProfileRow> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.user_id] = {
          user_id: p.user_id,
          full_name: p.full_name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      });

      setBlockedProfiles(map);
    } catch (e) {
      console.log("[Settings] loadBlockedUsers failed:", e);
      setBlocked([]);
      setBlockedProfiles({});
    } finally {
      setBlockedLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
    void loadBlockedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function saveUsername() {
    if (!user?.id) return;
    if (savingUsername) return;

    const normalized = normalizeUsername(usernameDraft);

    if (!isValidUsername(normalized)) {
      toast({
        title: t("settings.username_invalid_title"),
        description: t("settings.username_invalid_desc"),
        variant: "destructive",
      });
      return;
    }

    if (normalized === lastSavedUsernameRef.current) {
      setUsernameSavedAt(Date.now());
      return;
    }

    setSavingUsername(true);
    try {
      const updRes = await withTimeout(
        supabase
          .from("profiles")
     .upsert(
       { user_id: user.id, avatar_url: publicUrl },
       { onConflict: "user_id" }
     ),
        12000
      );

      const { error } = updRes as any;
      if (error) throw error;

      lastSavedUsernameRef.current = normalized;

      setProfile((prev) =>
        prev
          ? { ...prev, username: normalized }
          : { user_id: user.id, full_name: null, username: normalized, avatar_url: null }
      );

      setUsernameDraft(`@${normalized}`);
      setUsernameSavedAt(Date.now());

      toast({
        title: t("settings.username_saved_title"),
        description: `@${normalized}`,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      const takenHint =
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("23505");

      toast({
        title: t("settings.username_save_failed_title"),
        description: takenHint ? t("settings.username_taken") : msg,
        variant: "destructive",
      });
    } finally {
      setSavingUsername(false);
    }
  }

  async function onPickAvatar(file: File) {
    if (!user?.id) return;

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const filePath = `${user.id}/${Date.now()}.${safeExt}`;

      const upRes = await withTimeout(
        supabase.storage.from("avatars").upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/jpeg",
        }),
        12000
      );

      const { error: upErr } = upRes as any;
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;

      const updRes = await withTimeout(
        supabase
          .from("profiles")
          .upsert(
            { id: user.id, user_id: user.id, avatar_url: publicUrl },
            { onConflict: "id" }
          ),
        12000
      );

      const { error: updErr } = updRes as any;
      if (updErr) throw updErr;

      setProfile((prev) =>
        prev
          ? { ...prev, avatar_url: publicUrl }
          : { user_id: user.id, full_name: null, username: null, avatar_url: publicUrl }
      );
    } catch (e) {
      console.error("[Avatar] FAILED:", e);
      toast({
        title: t("settings.avatar_failed_title"),
        description: String((e as any)?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function unblockUser(blockedId: string) {
    if (!user?.id) return;

    try {
      await withTimeout(
        supabase
          .from("blocked_users")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", blockedId),
        12000
      );
      await loadBlockedUsers();
    } catch (e) {
      console.log("[Settings] unblock failed:", e);
    }
  }

  async function handleToggleAdhan(next: boolean) {
    setAdhanEnabled(next);

    const s: any = loadAdhanSettings() || {};
    const nextSettings = { ...s, enabled: next };
    saveAdhanSettings(nextSettings);

    if (next) {
      try {
        await fireAdhanInstantTest();
      } catch {
        // ignore
      }

      try {
        await cancelAdhanNotifications();
      } catch {
        // ignore
      }

      const active = pickActiveCoords(nextSettings);
      if (active) {
        void scheduleAdhanForToday(nextSettings);
        toast({
          title: t("settings.adhan_enabled"),
          description: t("settings.adhan_note"),
        });
      } else {
        toast({
          title: t("settings.adhan_enabled"),
          description: t("settings.adhan_need_location"),
          variant: "destructive",
        });
      }
    } else {
      void cancelAdhanNotifications();

      toast({
        title: t("settings.adhan_disabled"),
        description: t("settings.adhan_note"),
      });
    }
  }

  function handleSaveAdhanLocation() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({
        title: t("settings.invalid_location"),
        description: t("settings.invalid_location_desc"),
        variant: "destructive",
      });
      return;
    }

    setAdhanLocationMode("manual");

    const s: any = loadAdhanSettings() || {};
    const next: any = {
      ...s,
      locationMode: "manual",
      manualLat: lat,
      manualLng: lng,
      deviceLat: undefined,
      deviceLng: undefined,
    };

    saveAdhanSettings(next);

    setSavedManualCoords({ lat, lng });
    setSavedDeviceCoords({ lat: null, lng: null });
    setLocationSavedAt(Date.now());

    if (adhanEnabled) {
      const s2: any = loadAdhanSettings() || {};
      const active = pickActiveCoords(s2);
      if (active) void scheduleAdhanForToday(s2);
    }

    toast({
      title: t("settings.location_saved"),
      description: `${lat}, ${lng}`,
    });
  }

  async function handleUseDeviceLocation() {
    try {
      let lat: number;
      let lng: number;

      if (!Capacitor.isNativePlatform()) {
        if (!navigator.geolocation) {
          toast({
            title: t("settings.location_unavailable"),
            description: t("settings.location_unavailable_desc"),
            variant: "destructive",
          });
          return;
        }

        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
          });
        });

        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else {
        const perm = await Geolocation.checkPermissions();
        const state = perm.location;

        if (state !== "granted") {
          const req = await Geolocation.requestPermissions();
          if (req.location !== "granted") {
            persistLocationModeExclusive("manual");
            setAdhanLocationMode("manual");
            setSavedDeviceCoords({ lat: null, lng: null });

            toast({
              title: t("settings.permission_needed"),
              description: t("settings.permission_needed_desc"),
              variant: "destructive",
            });
            return;
          }
        }

        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
        });

        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      setAdhanLocationMode("device");

      const s: any = loadAdhanSettings() || {};
      const next: any = {
        ...s,
        locationMode: "device",
        deviceLat: lat,
        deviceLng: lng,
        manualLat: undefined,
        manualLng: undefined,
      };

      saveAdhanSettings(next);

      setSavedDeviceCoords({ lat, lng });
      setSavedManualCoords({ lat: null, lng: null });

      setLocationSavedAt(Date.now());

      if (adhanEnabled) {
        const s2: any = loadAdhanSettings() || {};
        const active = pickActiveCoords(s2);
        if (active) void scheduleAdhanForToday(s2);
      }

      toast({
        title: t("settings.device_location_captured"),
        description: `${lat}, ${lng}`,
      });
    } catch (e: any) {
      toast({
        title: t("settings.could_not_get_location"),
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    }
  }

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 pb-24">

        <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

        <div className="mt-6 rounded-xl border p-4 text-sm text-muted-foreground">
          {t("settings.sign_in_required", { defaultValue: "Please sign in to view settings." })}
        </div>
      </div>
    );
  }

  const normalizedPreview = normalizeUsername(usernameDraft);
  const usernameOk = isValidUsername(normalizedPreview);
  const usernameUnchanged = normalizedPreview === lastSavedUsernameRef.current;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-24">
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="mb-4 text-sm text-muted-foreground hover:text-foreground"
    >
      ✕ Close
    </button>

      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
<button
  type="button"
  onClick={() => navigate("/notifications")}
  className="w-full mt-4 rounded-xl border px-4 py-3 text-left hover:bg-muted"
>
  Notifications
</button>
      <div className="mt-6 space-y-4">
        {/* Profile */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">{t("settings.profile")}</div>

          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={`${profile.avatar_url}?v=${Date.now()}`}
                  alt={t("settings.profile_alt")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm text-muted-foreground">{t("settings.no_photo")}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {profileLoading ? t("loading") : displayName}
              </div>
              <div className="text-sm text-muted-foreground truncate">{emailText}</div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickAvatar(f);
                  e.currentTarget.value = "";
                }}
                className="hidden"
              />

              <span
                className={[
                  "inline-flex items-center justify-center",
                  "rounded-xl border px-4 py-2 text-sm cursor-pointer",
                  uploading ? "opacity-60 pointer-events-none" : "",
                ].join(" ")}
              >
                {uploading ? t("settings.uploading") : t("settings.change_photo")}
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-xl border bg-card/50 p-3">
            <div className="text-sm font-medium">{t("settings.username_label")}</div>
            <div className="text-xs text-muted-foreground mt-1">{t("settings.username_help")}</div>

            <div className="mt-3 flex gap-2">
              <Input
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value);
                  setUsernameSavedAt(null);
                }}
                placeholder={t("settings.username_placeholder")}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveUsername();
                }}
              />

              <Button
                type="button"
                onClick={() => void saveUsername()}
                disabled={savingUsername || !usernameOk || usernameUnchanged}
              >
                {savingUsername
                  ? t("settings.saving")
                  : usernameUnchanged
                    ? t("settings.saved")
                    : t("settings.save")}
              </Button>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              {t("settings.username_preview")}:{" "}
              {normalizedPreview ? `@${normalizedPreview}` : t("settings.none")}
              {!usernameOk && usernameDraft.trim().length > 0 ? (
                <span className="ml-2 text-destructive">
                  {t("settings.username_invalid_short")}
                </span>
              ) : null}
            </div>

            {usernameSavedAt ? (
              <div className="mt-2 text-xs text-green-600">{t("settings.username_saved_hint")}</div>
            ) : null}
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">{t("settings.appearance")}</div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.theme")}</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Online visibility */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-2">{t("settings.online_visibility")}</div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{onlineLabel}</p>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setHideOnline((v) => !v)}
            >
              {hideOnline ? t("settings.show_online") : t("settings.hide_online")}
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">{t("settings.stored_on_device")}</p>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">{t("settings.notifications")}</div>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t("settings.messages")}</span>
            <input
              type="checkbox"
              checked={messageNotifs}
              onChange={(e) => setMessageNotifs(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t("settings.calls")}</span>
            <input
              type="checkbox"
              checked={callNotifs}
              onChange={(e) => setCallNotifs(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t("settings.adhan")}</span>
            <input
              type="checkbox"
              checked={adhanEnabled}
              onChange={(e) => void handleToggleAdhan(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <div className="mt-2 rounded-lg border bg-card/50 p-3 space-y-3">
            <div className="text-sm font-medium">{t("settings.adhan_location_title")}</div>

            <div className="text-xs text-muted-foreground">
              {t("settings.adhan_location_subtitle")}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={adhanLocationMode === "device" ? "default" : "outline"}
                onClick={() => void handleUseDeviceLocation()}
              >
                {t("settings.adhan_location_device")}
              </Button>

              <Button
                type="button"
                variant={adhanLocationMode === "manual" ? "default" : "outline"}
                onClick={() => {
                  setAdhanLocationMode("manual");
                  persistLocationModeExclusive("manual");
                }}
              >
                {t("settings.adhan_location_manual")}
              </Button>
            </div>

            {adhanLocationMode === "device" ? (
              <div className="text-xs text-muted-foreground">
                {savedDeviceCoords.lat != null && savedDeviceCoords.lng != null
                  ? `${t("settings.device_location_saved")}: ${savedDeviceCoords.lat}, ${savedDeviceCoords.lng}`
                  : t("settings.device_location_not_saved")}
              </div>
            ) : null}

            {adhanLocationMode === "manual" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("settings.latitude")}</div>
                  <Input
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    inputMode="decimal"
                    placeholder={t("settings.latitude_placeholder")}
                  />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("settings.longitude")}</div>
                  <Input
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    inputMode="decimal"
                    placeholder={t("settings.longitude_placeholder")}
                  />
                </div>

                <div className="col-span-2">
                  {manualCoordsDirty ? (
                    <Button type="button" className="w-full" onClick={handleSaveAdhanLocation}>
                      {t("settings.save_location")}
                    </Button>
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      {locationSavedAt ? t("settings.saved") : t("settings.location_up_to_date")}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-muted-foreground">{t("settings.local_toggles_note")}</div>
        </div>

        {/* Account deletion */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-2">
            {t("settings.account_deletion", { defaultValue: "Account deletion" })}
          </div>

          <p className="text-sm text-muted-foreground">
            {t("settings.deletion_intro", {
              defaultValue: "You can request deletion of your account and associated data.",
            })}
          </p>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t("settings.request_deletion", { defaultValue: "Request account deletion" })}
            </button>
          </div>
        </div>

        {/* Blocked users */}
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">{t("settings.blocked_users")}</div>

          {blockedLoading ? (
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          ) : blocked.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("settings.no_blocked_users")}</div>
          ) : (
            <div className="space-y-3">
              {blocked.map((b) => {
                const p = blockedProfiles[b.blocked_id];
                const name =
                  p?.full_name?.trim() ||
                  (p?.username?.trim() ? `@${p.username.trim()}` : "") ||
                  t("settings.blocked_fallback_name");
                const avatar = p?.avatar_url || null;

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {avatar ? (
                          <img src={avatar} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("settings.no_photo")}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{b.blocked_id}</div>
                      </div>
                    </div>

                    <button
                      className="shrink-0 rounded-xl border px-3 py-2 text-sm"
                      onClick={() => void unblockUser(b.blocked_id)}
                      type="button"
                    >
                      {t("settings.unblock")}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Language */}
        <LanguageSection />

        {/* Sign out */}
        <button
          className="w-full rounded-xl bg-primary text-primary-foreground py-3"
          onClick={() => void doSignOut()}
          type="button"
          disabled={!user?.id}
        >
          {t("settings.signout")}
        </button>
      </div>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background border shadow-xl p-5">
            <h2 className="text-lg font-semibold">
              {t("settings.delete_confirm_title", { defaultValue: "Delete account?" })}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.delete_confirm_body", {
                defaultValue:
                  "You are about to continue to the account deletion page. Deleting your account is permanent and cannot be undone.",
              })}
            </p>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  openDeleteAccountPage();
                }}
              >
                {t("settings.continue_delete", { defaultValue: "Continue" })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}