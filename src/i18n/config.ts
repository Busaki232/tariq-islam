// src/i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English
import enCommon from "./locales/en/common.json";
import enNavigation from "./locales/en/navigation.json";
import enAuth from "./locales/en/auth.json";
import enPrayer from "./locales/en/prayer.json";
import enQuran from "./locales/en/quran.json";
import enFeatures from "./locales/en/features.json";
import enChat from "./locales/en/chat.json";
import enPrivateChat from "./locales/en/privateChat.json";
import enPolicies from "./locales/en/policies.json";
import enPrivacy from "./locales/en/privacy.json";
import enCommunityGuidelines from "./locales/en/communityGuidelines.json";
import enChildSafetyPolicy from "./locales/en/childSafetyPolicy.json";
import enSupport from "./locales/en/support.json";
import enContact from "./locales/en/contact.json";
import enMarketplace from "./locales/en/marketplace.json";
import enPartnerships from "./locales/en/partnerships.json";
import enEvents from "./locales/en/events.json";
import enMosques from "./locales/en/mosques.json";
import enDashboard from "./locales/en/dashboard.json";
import enIslamicCalendar from "./locales/en/islamicCalendar.json";
import enAds from "@/i18n/locales/en/ads.json";



// French
import frCommon from "./locales/fr/common.json";
import frNavigation from "./locales/fr/navigation.json";
import frAuth from "./locales/fr/auth.json";
import frPrayer from "./locales/fr/prayer.json";
import frQuran from "./locales/fr/quran.json";
import frFeatures from "./locales/fr/features.json";
import frChat from "./locales/fr/chat.json";
import frPrivateChat from "./locales/fr/privateChat.json";
import frPolicies from "./locales/fr/policies.json";
import frPrivacy from "./locales/fr/privacy.json";
import frCommunityGuidelines from "./locales/fr/communityGuidelines.json";
import frChildSafetyPolicy from "./locales/fr/childSafetyPolicy.json";
import frSupport from "./locales/fr/support.json";
import frContact from "./locales/fr/contact.json";
import frMarketplace from "./locales/fr/marketplace.json";
import frPartnerships from "./locales/fr/partnerships.json";
import frEvents from "./locales/fr/events.json";
import frMosques from "./locales/fr/mosques.json";
import frDashboard from "./locales/fr/dashboard.json";
import frIslamicCalendar from "./locales/fr/islamicCalendar.json";
import frAds from "@/i18n/locales/fr/ads.json";

// Hausa
import haCommon from "./locales/ha/common.json";
import haNavigation from "./locales/ha/navigation.json";
import haAuth from "./locales/ha/auth.json";
import haPrayer from "./locales/ha/prayer.json";
import haQuran from "./locales/ha/quran.json";
import haFeatures from "./locales/ha/features.json";
import haChat from "./locales/ha/chat.json";
import haPrivateChat from "./locales/ha/privateChat.json";
import haPolicies from "./locales/ha/policies.json";
import haPrivacy from "./locales/ha/privacy.json";
import haCommunityGuidelines from "./locales/ha/communityGuidelines.json";
import haChildSafetyPolicy from "./locales/ha/childSafetyPolicy.json";
import haSupport from "./locales/ha/support.json";
import haContact from "./locales/ha/contact.json";
import haMarketplace from "./locales/ha/marketplace.json";
import haPartnerships from "./locales/ha/partnerships.json";
import haEvents from "./locales/ha/events.json";
import haMosques from "./locales/ha/mosques.json";
import haDashboard from "./locales/ha/dashboard.json";
import haIslamicCalendar from "./locales/ha/islamicCalendar.json";
import haAds from "@/i18n/locales/ha/ads.json";


// Arabic
import arCommon from "./locales/ar/common.json";
import arNavigation from "./locales/ar/navigation.json";
import arAuth from "./locales/ar/auth.json";
import arPrayer from "./locales/ar/prayer.json";
import arQuran from "./locales/ar/quran.json";
import arFeatures from "./locales/ar/features.json";
import arChat from "./locales/ar/chat.json";
import arPrivateChat from "./locales/ar/privateChat.json";
import arPolicies from "./locales/ar/policies.json";
import arPrivacy from "./locales/ar/privacy.json";
import arCommunityGuidelines from "./locales/ar/communityGuidelines.json";
import arChildSafetyPolicy from "./locales/ar/childSafetyPolicy.json";
import arSupport from "./locales/ar/support.json";
import arContact from "./locales/ar/contact.json";
import arMarketplace from "./locales/ar/marketplace.json";
import arPartnerships from "./locales/ar/partnerships.json";
import arEvents from "./locales/ar/events.json";
import arMosques from "./locales/ar/mosques.json";
import arDashboard from "./locales/ar/dashboard.json";
import arIslamicCalendar from "./locales/ar/islamicCalendar.json";
import arAds from "@/i18n/locales/ar/ads.json";



const SUPPORTED = ["en", "fr", "ha", "ar"] as const;
type SupportedLang = (typeof SUPPORTED)[number];

function normalizeLng(raw: string): SupportedLang {
  const v = (raw || "").toLowerCase();
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("ha")) return "ha";
  if (v.startsWith("ar")) return "ar";
  return "en";
}

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    auth: enAuth,
    prayer: enPrayer,
    quran: enQuran,
    features: enFeatures,
    chat: enChat,
    privateChat: enPrivateChat,
    policies: enPolicies,
    privacy: enPrivacy,
    communityGuidelines: enCommunityGuidelines,
    childSafetyPolicy: enChildSafetyPolicy,
    support: enSupport,
    contact: enContact,
    marketplace: enMarketplace,
    partnerships: enPartnerships,
    events: enEvents,
    mosques: enMosques,
    dashboard: enDashboard,
    islamicCalendar: enIslamicCalendar,
    ads: enAds,
  },
  fr: {
    common: frCommon,
    navigation: frNavigation,
    auth: frAuth,
    prayer: frPrayer,
    quran: frQuran,
    features: frFeatures,
    chat: frChat,
    privateChat: frPrivateChat,
    policies: frPolicies,
    privacy: frPrivacy,
    communityGuidelines: frCommunityGuidelines,
    childSafetyPolicy: frChildSafetyPolicy,
    support: frSupport,
    contact: frContact,
    marketplace: frMarketplace,
    partnerships: frPartnerships,
    events: frEvents,
    mosques: frMosques,
    dashboard: frDashboard,
    islamicCalendar: frIslamicCalendar,
    ads: frAds,

  },
  ha: {
    common: haCommon,
    navigation: haNavigation,
    auth: haAuth,
    prayer: haPrayer,
    quran: haQuran,
    features: haFeatures,
    chat: haChat,
    privateChat: haPrivateChat,
    policies: haPolicies,
    privacy: haPrivacy,
    communityGuidelines: haCommunityGuidelines,
    childSafetyPolicy: haChildSafetyPolicy,
    support: haSupport,
    contact: haContact,
    marketplace: haMarketplace,
    partnerships: haPartnerships,
    events: haEvents,
    mosques: haMosques,
    dashboard: haDashboard,
    islamicCalendar: haIslamicCalendar,
    ads: haAds,

  },
  ar: {
    common: arCommon,
    navigation: arNavigation,
    auth: arAuth,
    prayer: arPrayer,
    quran: arQuran,
    features: arFeatures,
    chat: arChat,
    privateChat: arPrivateChat,
    policies: arPolicies,
    privacy: arPrivacy,
    communityGuidelines: arCommunityGuidelines,
    childSafetyPolicy: arChildSafetyPolicy,
    support: arSupport,
    contact: arContact,
    marketplace: arMarketplace,
    partnerships: arPartnerships,
    events: arEvents,
    mosques: arMosques,
    dashboard: arDashboard,
    islamicCalendar: arIslamicCalendar,
    ads: arAds,

  },
} as const;

function applyDirAndLang(lngRaw: string) {
  const lng = normalizeLng(lngRaw);
  const rtl = lng === "ar";
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
}

function readStoredLanguage(): SupportedLang | null {
  try {
    const a = localStorage.getItem("app_language") || "";
    const b = localStorage.getItem("i18nextLng") || "";
    const picked = a || b;
    return picked ? normalizeLng(picked) : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(lng: SupportedLang) {
  try {
    localStorage.setItem("app_language", lng);
    localStorage.setItem("i18nextLng", lng);
  } catch {
    // ignore
  }
}

const storedAtBoot = readStoredLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    load: "languageOnly",
    fallbackLng: { default: ["en"] },
    supportedLngs: [...SUPPORTED],
    nonExplicitSupportedLngs: true,

    defaultNS: "common",
    ns: [
      "common",
      "navigation",
      "auth",
      "prayer",
      "quran",
      "features",
      "chat",
      "privateChat",
      "policies",
      "privacy",
      "communityGuidelines",
      "childSafetyPolicy",
      "support",
      "contact",
      "marketplace",
      "partnerships",
      "events",
      "mosques",
      "dashboard",
      "islamicCalendar",
      "ads",
    ],

    interpolation: { escapeValue: false },

    detection: {
      // Prefer app_language first (your Settings writes it),
      // then fall back to i18nextLng if it exists,
      // then navigator.
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "app_language",
      caches: ["localStorage"],
    },

    returnNull: false,
    returnEmptyString: false,
  })
  .then(() => {
    const active = normalizeLng(i18n.resolvedLanguage || i18n.language || "en");
    applyDirAndLang(active);

    // If we already had a stored language, force i18n to it once at boot
    // to avoid “flicker” or mixed namespaces.
    if (storedAtBoot && storedAtBoot !== active) {
      writeStoredLanguage(storedAtBoot);
      void i18n.changeLanguage(storedAtBoot);
    } else {
      writeStoredLanguage(active);
    }
  })
  .catch((e) => {
    console.error("[i18n] init failed:", e);
  });

i18n.on("languageChanged", (lng) => {
  const normalized = normalizeLng(lng);
  writeStoredLanguage(normalized);
  applyDirAndLang(normalized);
});

export default i18n;