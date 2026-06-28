// src/components/BottomNav.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  Compass,
  MessageCircle,
  Users,
  Settings,
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
  const { t } = useTranslation("navigation");
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadConversationId, setUnreadConversationId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

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
    console.error("Unread messages error:", JSON.stringify(error, null, 2));
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
        () => {
          void loadUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

useEffect(() => {
  if (!user?.id) {
    setNotificationCount(0);
    return;
  }

  const loadNotifications = async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Notification count error:", error);
      return;
    }

    setNotificationCount(count ?? 0);
  };

  void loadNotifications();

  const channel = supabase
    .channel(`bottom-nav-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      () => {
        void loadNotifications();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [user?.id]);

  const items: Item[] = useMemo(
    () => [
      {
        label: t("bottomNav.home", { defaultValue: "Home" }),
        to: "/",
        icon: Home,
      },
      {
        label: t("bottomNav.quran", { defaultValue: "Quran" }),
        to: "/quran",
        icon: BookOpen,
      },
      {
        label: t("bottomNav.qibla", { defaultValue: "Qibla" }),
        to: "/qibla",
        icon: Compass,
      },
      {
        label: t("bottomNav.tasbih", { defaultValue: "Tasbih" }),
        to: "/tasbih",
        emoji: "📿",
      },
      {
        label: t("bottomNav.messages", { defaultValue: "Messages" }),
        to: "/messages",
        icon: MessageCircle,
        badge: unreadMessages > 0 ? unreadMessages : undefined,
      },
      {
        label: t("bottomNav.community", { defaultValue: "Community" }),
        to: "/chat-room",
        icon: Users,
      },
    {
      label: t("bottomNav.settings", { defaultValue: "settings" }),
      to: "/settings",
      icon: Settings,
      badge: notificationCount > 0 ? notificationCount : undefined,
    },
    ],
    [t, unreadMessages, notificationCount]
  );

  const normalizePath = (to: string) => to.split("#")[0];

  const isActive = (to: string) => {
    const base = normalizePath(to);
    if (base === "/") return location.pathname === "/";
    return location.pathname === base;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 px-2 py-2 pb-safe min-w-max">
          {items.map((it) => {
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
                  "relative flex flex-col items-center justify-center",
                  "min-w-[72px] px-3 py-2 rounded-xl",
                  "transition",
                  active
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                ].join(" ")}
              >
                <div className="relative">
                  {it.emoji ? (
                    <span style={{ fontSize: 20, lineHeight: "20px" }}>
                      {it.emoji}
                    </span>
                  ) : (
                    Icon && <Icon size={20} />
                  )}

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
    </div>
  );
}