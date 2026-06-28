// src/components/TopBackBar.tsx
import React, { useMemo, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

type TitleKey =
  | "messages"
  | "groups"
  | "profile"
  | "settings"
  | "communityGuidelines"
  | "chatRoom"
  | "app";

function getTitleKey(pathname: string): TitleKey {
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/groups")) return "groups";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/community-guidelines")) return "communityGuidelines";
  if (pathname.startsWith("/chat-room") || pathname.startsWith("/chat")) return "chatRoom";
  return "app";
}

export default function TopBackBar({
  title,
  right,
}: {
  title?: string;
  right?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const { t } = useTranslation("navigation");
  const handledRef = useRef(false);

  const hideRightMenu =
    location.pathname.startsWith("/chat-room") ||
    location.pathname.startsWith("/chat") ||
    (location.pathname === "/community-guidelines" && sp.get("embed") === "1");

  const computedTitle = useMemo(() => {
    if (title) return title;

    const key = getTitleKey(location.pathname);

    const fallback =
      key === "app"
        ? "Tariq Islam"
        : key === "communityGuidelines"
          ? "Community Guidelines"
          : key === "chatRoom"
            ? "Chat Room"
            : " ";

    return t(`titles.${key}`, { defaultValue: fallback });
  }, [title, location.pathname, t]);

  const goBack = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    navigate(-1);
    window.setTimeout(() => {
      handledRef.current = false;
    }, 250);
  };

  return (
    <div
      className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    >
      <div className="h-16 px-3 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-foreground shadow-none transition active:scale-95 touch-manipulation focus:outline-none"
          aria-label={t("back", { defaultValue: "Back" })}
          title={t("back", { defaultValue: "Back" })}
        >
          <ArrowLeft className="h-8 w-8" strokeWidth={2.5} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-6">
            {computedTitle}
          </div>
        </div>

        {!hideRightMenu && right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}