// src/components/LanguageSwitcher.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/config";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUPPORTED_LANGS = [
  { code: "en", labelKey: "settings.language.english", fallback: "English" },
  { code: "fr", labelKey: "settings.language.french", fallback: "Français" },
  { code: "ha", labelKey: "settings.language.hausa", fallback: "Hausa" },
  { code: "ar", labelKey: "settings.language.arabic", fallback: "العربية" },
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number]["code"];

function normalizeToSupported(code: string): SupportedLang {
  const c = (code || "").toLowerCase();
  if (c.startsWith("fr")) return "fr";
  if (c.startsWith("ha")) return "ha";
  if (c.startsWith("ar")) return "ar";
  return "en";
}

export default function LanguageSwitcher() {
  const { t } = useTranslation();

  const [lang, setLang] = useState<SupportedLang>(() =>
    normalizeToSupported(i18n.resolvedLanguage || i18n.language || "en")
  );

  // Keep local state in sync if language is changed elsewhere
  useEffect(() => {
    setLang(normalizeToSupported(i18n.resolvedLanguage || i18n.language || "en"));
  }, [i18n.resolvedLanguage, i18n.language]);

  const currentLabel = useMemo(() => {
    const found = SUPPORTED_LANGS.find((l) => l.code === lang);
    if (!found) return "EN";
    const text = t(found.labelKey, { defaultValue: found.fallback });
    // short label for header
    if (lang === "en") return "EN";
    if (lang === "fr") return "FR";
    if (lang === "ha") return "HA";
    return "AR";
  }, [lang, t]);

  return (
    <Select
      value={lang}
      onValueChange={(v) => {
        const next = normalizeToSupported(String(v));
        setLang(next);
        try {
          localStorage.setItem("i18nextLng", next);
          localStorage.setItem("app_language", next);
        } catch {
          // ignore
        }
        void i18n.changeLanguage(next);
      }}
    >
      <SelectTrigger
        className={[
          "h-9 w-[88px] justify-between",
          "bg-background text-foreground",
          "border border-border",
          "hover:bg-muted/50",
        ].join(" ")}
        aria-label="Language"
      >
        <SelectValue placeholder={currentLabel} />
      </SelectTrigger>

      <SelectContent
        className={[
          "z-50",
          "bg-popover text-popover-foreground",
          "border border-border",
          "shadow-md",
        ].join(" ")}
      >
        {SUPPORTED_LANGS.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {t(l.labelKey, { defaultValue: l.fallback })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}