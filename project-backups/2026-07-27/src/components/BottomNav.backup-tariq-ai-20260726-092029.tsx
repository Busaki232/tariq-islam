// src/components/BottomNav.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  BookOpen,
  Bookmark,
  Clock3,
  Compass,
  MessageCircle,
  Phone,
  User,
  Grid3X3,
  ListVideo,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  label: string;
  to: string;
  icon?: any;
  emoji?: string;
  badge?: number;
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { user } = useAuth();

  const [showIbadah, setShowIbadah] = useState(false);
  const [ownedScholarId, setOwnedScholarId] =
    useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadConversationId, setUnreadConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return;
    }

    const loadUnreadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, read_by, created_at")
        .eq("recipient_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Unread messages error:", error);
        return;
      }

      const readByIncludes = (read_by: any, userId: string) => {
        if (!read_by) return false;
        if (Array.isArray(read_by)) return read_by.includes(userId);
        if (typeof read_by === "object") return Boolean(read_by[userId]);
        return false;
      };


      const unreadRows = (data ?? []).filter(
        (m) => !readByIncludes(m.read_by, user.id)
      );

      setUnreadMessages(unreadRows.length);
      setUnreadConversationId(unreadRows[0]?.sender_id ?? null);
    };

    void loadUnreadMessages();

    const channel = supabase
      .channel(`bottom-nav-unread-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void loadUnreadMessages()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
useEffect(() => {
  const loadOwnedScholar = async () => {
    if (!user?.id) {
      setOwnedScholarId(null);
      return;
    }

    const { data, error } = await supabase
      .from("scholar_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("verification_status", "approved")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error(
        "Unable to load owned scholar profile:",
        error
      );

      setOwnedScholarId(null);
      return;
    }

    setOwnedScholarId(data?.id ?? null);
  };

  void loadOwnedScholar();
}, [user?.id]);

  const items: Item[] = useMemo(
    () => [
      {
        label: t("bottomNav.home", { defaultValue: "Home" }),
        to: "/",
        icon: Home,
      },
      {
        label: t("bottomNav.messages", { defaultValue: "Messages" }),
        to: "/messages",
        icon: MessageCircle,
        badge: unreadMessages > 0 ? unreadMessages : undefined,
      },
      {
        label: t("bottomNav.calls", { defaultValue: "Calls" }),
        to: "/calls",
        icon: Phone,
      },
      {
        label: t("bottomNav.profile", { defaultValue: "Profile" }),
        to: "/profile",
        icon: User,
      },
    ],
    [t, unreadMessages]
  );

  const normalizePath = (to: string) => to.split("#")[0];

  const isActive = (to: string) => {
    const base = normalizePath(to);
    if (base === "/") return location.pathname === "/";
    return location.pathname === base;
  };

  const goToIbadahPage = (to: string) => {
    setShowIbadah(false);
    navigate(to);
  };

  return (
    <>
      {showIbadah && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40"
          onClick={() => setShowIbadah(false)}
        >
          <div
            className="absolute bottom-20 left-4 right-4 rounded-2xl border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-3">
              {t("bottomNav.ibadah", { defaultValue: "Ibadah" })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => goToIbadahPage("/quran")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <BookOpen size={22} />
                <span className="text-sm">
                  {t("moreMenu.quran", { defaultValue: "Quran" })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => goToIbadahPage("/qibla")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <Compass size={22} />
                <span className="text-sm">
                  {t("moreMenu.qibla", { defaultValue: "Qibla" })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => goToIbadahPage("/tasbih")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <span className="text-2xl">📿</span>
                <span className="text-sm">
                  {t("moreMenu.tasbih", { defaultValue: "Tasbih" })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToIbadahPage("/mosques")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <span className="text-2xl">🕌</span>

                <span className="text-sm">
                  {t("bottomNav.mosques", { defaultValue: "Mosques" })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToIbadahPage("/scholars")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <BookOpen size={22} />

                <span className="text-sm">
                  {t("bottomNav.scholars", {
                    defaultValue: "Scholars",
                  })}
                </span>
              </button>
              {ownedScholarId && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      goToIbadahPage(
                        `/scholars/${ownedScholarId}/lectures`
                      )
                    }
                    className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted"
                  >
                    <BookOpen size={22} />

                    <span className="text-sm">
                      {t("bottomNav.myLectures", {
                        defaultValue: "My Lectures",
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goToIbadahPage(
                        `/scholars/${ownedScholarId}/playlists`
                      )
                    }
                    className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted"
                  >
                    <ListVideo size={22} />

                    <span className="text-sm">
                      {t("bottomNav.managePlaylists", {
                        defaultValue: "Manage Playlists",
                      })}
                    </span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => goToIbadahPage("/saved-scholar-lectures")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <Bookmark size={22} />

                <span className="text-sm">
                  {t("bottomNav.savedLectures", {
                    defaultValue: "Saved Lectures",
                  })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToIbadahPage("/continue-watching")}
                className="rounded-xl border p-4 flex flex-col items-center gap-2 hover:bg-muted"
              >
                <Clock3 size={22} />

                <span className="text-sm">
                  {t("bottomNav.continueWatching", {
                    defaultValue: "Continue Watching",
                  })}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur">
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          <Link
            to="/"
            className={[
              "relative flex flex-col items-center justify-center min-w-[64px] px-1 py-2 rounded-xl transition",
              isActive("/")
                ? "text-foreground bg-secondary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            ].join(" ")}
          >
            <Home size={20} />
            <span className="text-[10px] mt-1">
              {t("bottomNav.home", { defaultValue: "Home" })}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setShowIbadah(true)}
            className={[
              "relative flex flex-col items-center justify-center min-w-[64px] px-1 py-2 rounded-xl transition",
         [
           "/quran",
           "/qibla",
           "/tasbih",
           "/mosques",
           "/scholars",
           "/saved-scholar-lectures",
           "/continueWatching",
         ].includes(location.pathname) ||
           location.pathname.startsWith("/mosques/") ||
           location.pathname.startsWith("/scholars/")       ? "text-foreground bg-secondary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            ].join(" ")}
          >
            <Grid3X3 size={20} />
            <span className="text-[10px] mt-1">
              {t("bottomNav.ibadah", { defaultValue: "Ibadah" })}
            </span>
          </button>


          {items.slice(1).map((it) => {
            const active = isActive(it.to);
            const Icon = it.icon;

            return (
              <Link
                key={it.to}
                to={
                  it.to === "/messages" && unreadConversationId
                    ? `/messages/${unreadConversationId}`
                    : it.to
                }
                className={[
                  "relative flex flex-col items-center justify-center min-w-[64px] px-1 py-2 rounded-xl transition",
                  active
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                ].join(" ")}
              >
                <div className="relative">
                  {Icon && <Icon size={20} />}

                  {typeof it.badge === "number" && it.badge > 0 && (
                    <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center px-1">
                      {it.badge > 99 ? "99+" : it.badge}
                    </span>
                  )}
                </div>

                <span className="text-[10px] mt-1">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}