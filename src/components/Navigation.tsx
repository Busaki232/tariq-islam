// src/components/Navigation.tsx
import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Home,
  Users,
  MapPin,
  ShoppingBag,
  Building,
  Calendar,
  BarChart3,
  BookOpen,
  Shield,
  Store,
  Hand,
  LogIn,
  UserPlus,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) return null;

  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const { t } = useTranslation(["navigation", "common"]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return;
    }

    const loadUnreadMessages = async () => {
     const { data, error } = await supabase
       .from("messages")
       .select("id, read_by, is_deleted")
       .eq("recipient_id", user.id)
       .eq("is_deleted", false);

     if (error) {
       console.error("Unread messages count error:", error);
       return;
     }

     const unread = (data || []).filter((m: any) => {
       const readBy = Array.isArray(m.read_by) ? m.read_by : [];
       return !readBy.includes(user.id);
     }).length;

     setUnreadMessages(unread);
     };

     void loadUnreadMessages();

    const channel = supabase
      .channel(`nav-unread-messages-${user.id}`)
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

  const navItems = useMemo(() => {
    return [
      { name: t("navigation:home", { defaultValue: "Home" }), href: "/", icon: Home },

      ...(user
        ? [
            {
              name: t("navigation:dashboard", { defaultValue: "Dashboard" }),
              href: "/dashboard",
              icon: BarChart3,
            },
          ]
        : []),

      ...(isAdmin
        ? [
            {
              name: t("navigation:admin", { defaultValue: "Admin" }),
              href: "/admin",
              icon: Shield,
            },
            {
              name: t("navigation:moderation", { defaultValue: "Moderation" }),
              href: "/moderation",
              icon: Shield,
            },
          ]
        : []),

      { name: t("navigation:quran", { defaultValue: "Quran" }), href: "/#quran-section", icon: BookOpen },
      { name: t("navigation:tasbih", { defaultValue: "Tasbih" }), href: "/tasbih", icon: Hand },
      { name: t("navigation:chatRoom", { defaultValue: "Chat Room" }), href: "/chat-room", icon: MessageCircle },

      ...(user
        ? [
            {
              name: t("navigation:messages", { defaultValue: "Messages" }),
              href: "/messages",
              icon: MessageCircle,
              badge: unreadMessages,
            },
          ]
        : []),

      { name: t("navigation:mosques", { defaultValue: "Mosques" }), href: "/mosques", icon: Building },
      { name: t("navigation:events", { defaultValue: "Events" }), href: "/events", icon: Calendar },
      { name: t("navigation:marketplace", { defaultValue: "Marketplace" }), href: "/marketplace", icon: ShoppingBag },

      ...(user ? [{ name: t("navigation:myAds", { defaultValue: "My Ads" }), href: "/my-ads", icon: Store }] : []),

      { name: t("navigation:community", { defaultValue: "Community" }), href: "/#community", icon: Users },
      { name: t("navigation:locations", { defaultValue: "Locations" }), href: "/#midwest", icon: MapPin },
    ];
  }, [t, user, isAdmin, unreadMessages]);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href.startsWith("#")) return false;
    return location.pathname === href;
  };

  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 h-16">
          <Link to="/" className="flex items-center shrink-0">
            <span className="text-xl font-bold text-foreground">
              {t("navigation:appTitle", { defaultValue: "Tariq Islam" })}
            </span>
          </Link>

          <div className="flex-1 min-w-0 hidden lg:block">
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-2">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const badge = "badge" in item ? item.badge : 0;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={(e) => {
                      if (item.href.includes("#")) {
                        e.preventDefault();
                        const targetId = item.href.split("#")[1];
                        const targetElement = document.getElementById(targetId);
                        if (targetElement) {
                          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                        if (location.pathname !== "/") window.location.href = item.href;
                      }
                    }}
                    className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      isActive(item.href)
                        ? "bg-gradient-primary text-white shadow-islamic"
                        : "text-muted-foreground hover:text-islamic-green hover:bg-secondary/50"
                    }`}
                  >
                    <span className="relative">
                      <IconComponent size={18} />
                      {badge > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center px-1">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />

            {!user && (
              <>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-muted-foreground hover:text-islamic-green hover:bg-secondary/50"
                >
                  <LogIn size={18} />
                  <span className="font-medium hidden sm:inline">
                    {t("navigation:login", { defaultValue: "Log in" })}
                  </span>
                </Link>

                <Link
                  to="/auth?mode=signup"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-muted-foreground hover:text-islamic-green hover:bg-secondary/50"
                >
                  <UserPlus size={18} />
                  <span className="font-medium hidden sm:inline">
                    {t("navigation:signup", { defaultValue: "Sign up" })}
                  </span>
                </Link>
              </>
            )}

            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;