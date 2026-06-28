// src/pages/Events.tsx
import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, Users, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CreateEventModal } from "@/components/CreateEventModal";
import { EventDetailModal } from "@/components/EventDetailModal";
import { useTranslation } from "react-i18next";

console.log("EVENTS_TSX_PROOF_2026_01_18");

interface Event {
  id: string;
  title: string | null;
  description: string | null;
  event_date: string;
  event_time: string;
  location: string | null;
  category: string | null;
  attendees_count: number | null;
  max_attendees?: number | null;
  image_url?: string | null;
  organizer_id: string;
  status?: string | null;
}

const Events = () => {
  const { t, i18n } = useTranslation(["events", "common"]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const { user } = useAuth();
  const [debugLine, setDebugLine] = useState("boot");

// 🌍 Robust language detection for calendar formatting
const rawLang = (i18n.resolvedLanguage || i18n.language || "en").toLowerCase();

const pickIntlLocale = (l: string) => {
  const candidates = [
    l,
    l === "ha" ? "ha-NG" : "",
    l === "ha" ? "ha-Latn-NG" : "",
    "en",
  ].filter(Boolean);

  const supported = Intl.DateTimeFormat.supportedLocalesOf(candidates, {
    localeMatcher: "lookup",
  });

  return supported[0] || "en";
};

const intlLocale = pickIntlLocale(rawLang);

// 🌐 Localize known database-seeded event text
const localizeEventText = (text: string | null | undefined) => {
  const s = (text ?? "").trim();
  if (!s) return "";

  if (s === "Jumuah Prayer") {
    return t("known.jumuahTitle", { defaultValue: "Jumuah Prayer" });
  }

  if (s === "Weekly Friday congregational prayer") {
    return t("known.jumuahDesc", {
      defaultValue: "Weekly Friday congregational prayer",
    });
  }

  if (s === "Main Masjid") {
    return t("known.mainMasjid", { defaultValue: "Main Masjid" });
  }

  return s;
};

  const fetchEvents = async () => {
    setLoading(true);
    setDebugLine("fetch:start");

    const safety = setTimeout(() => {
      setDebugLine("fetch:still-hanging (15s) forcing UI");
      setLoading(false);
      toast.error(
        t("toast.hanging", {
          defaultValue: "Events request is hanging. Check network/Supabase URL.",
        })
      );
    }, 15000);

    try {
      setDebugLine("fetch:calling supabase");

      const result = await Promise.race([
        supabase
          .from("events")
          .select("*")
          .eq("status", "upcoming")
          .order("event_date", { ascending: true }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 12000)
        ),
      ]);

      // @ts-ignore
      const { data, error } = result;

      if (error) throw error;

      setEvents((data as Event[]) ?? []);
      setDebugLine(`fetch:ok (${(data ?? []).length})`);
    } catch (e: any) {
      setEvents([]);
      setDebugLine(`fetch:error (${e?.message ?? "unknown"})`);
      toast.error(
  e?.message === "timeout"
    ? t("toast.timeout", { defaultValue: "Events request timed out" })
    : t("toast.errorBody", { defaultValue: "Failed to load events. Please try again." })
      );
    } finally {
      clearTimeout(safety);
      setLoading(false);
      setDebugLine((s) => `${s} -> done`);
    }
  };

  useEffect(() => {
    void fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && categoryFilter === "all") return events;

    return events.filter((event) => {
      const title = (event.title ?? "").toLowerCase();
      const desc = (event.description ?? "").toLowerCase();
      const loc = (event.location ?? "").toLowerCase();
      const cat = (event.category ?? "general").toLowerCase();

      const matchesSearch = !q || title.includes(q) || desc.includes(q) || loc.includes(q);
      const matchesCategory = categoryFilter === "all" || cat === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, categoryFilter]);

  const formatDate = (date: string) => {
    try {
      const d = new Date(date);
      return new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);
    } catch {
      return date;
    }
  };

  const formatTime = (time: string) => {
    try {
      const d = new Date(`2000-01-01T${time}`);
      return new Intl.DateTimeFormat(lang, {
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return time;
    }
  };

  const getCategoryColor = (category: string | null) => {
    const c = (category ?? "general").toLowerCase();
    const colors = {
      religious:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      educational:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      cultural:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      social:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      general:
        "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return (colors as any)[c] || colors.general;
  };

  const labelCategory = (catRaw: string | null) => {
    const c = (catRaw ?? "general").toLowerCase();
    // these keys match the files I gave you: events.filters.religious, etc
    return t(`filters.${c}`, { defaultValue: c });
  };

  const handleEventCreated = () => {
    void fetchEvents();
    setShowCreateModal(false);
  };

  const handleViewDetails = (event: Event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  const getCapacityInfo = (event: Event) => {
    const max = event.max_attendees ?? null;
    const count = event.attendees_count ?? 0;
    if (!max || max <= 0) return null;

    const percentage = (count / max) * 100;
    const isFull = count >= max;
    return { percentage, isFull };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">
                {t("states.loading")} ({debugLine})
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                {t("header.title")}
              </h1>
              <p className="text-muted-foreground">{t("header.subtitle")}</p>
            </div>
            {user && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t("buttons.create")}
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t("filters.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.all")}</SelectItem>
              <SelectItem value="religious">{t("filters.religious")}</SelectItem>
              <SelectItem value="educational">{t("filters.educational")}</SelectItem>
              <SelectItem value="cultural">{t("filters.cultural")}</SelectItem>
              <SelectItem value="social">{t("filters.social")}</SelectItem>
              <SelectItem value="general">{t("filters.general")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("states.noResults")}</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || categoryFilter !== "all"
                ? t("states.noResults")
                : t("states.noUpcoming")}
            </p>
            {user && (
              <Button onClick={() => setShowCreateModal(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                {t("buttons.create")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const cat = (event.category ?? "general").toLowerCase();
              const count = event.attendees_count ?? 0;
              const cap = getCapacityInfo(event);

              return (
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                  {event.image_url && (
                    <div className="w-full h-48 bg-muted rounded-t-lg overflow-hidden">
                      <img
                        src={event.image_url}
                        alt={localizeEventText(event.title) || t("states.untitled")}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={getCategoryColor(cat)}>{labelCategory(cat)}</Badge>
                      {cap?.isFull ? (
                        <Badge variant="destructive">{t("states.full")}</Badge>
                      ) : cap && cap.percentage >= 80 ? (
                        <Badge variant="outline">{t("states.almostFull")}</Badge>
                      ) : null}
                    </div>

                    <CardTitle className="line-clamp-2">
                      {localizeEventText(event.title) || t("states.untitled")}
                    </CardTitle>

                    <CardDescription className="line-clamp-3">
                      {localizeEventText(event.description)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatDate(event.event_date)} {t("fields.at")} {formatTime(event.event_time)}
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2" />
                        {event.location ?? t("states.locationTBD")}
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        {t("states.attending", { count })}
                        {event.max_attendees ? ` / ${event.max_attendees} ${t("states.max")}` : ""}
                      </div>
                    </div>

                    {event.max_attendees ? (
                      <div className="mt-3">
                        <Progress value={cap?.percentage || 0} className="h-1.5" />
                      </div>
                    ) : null}

                    <div className="mt-4 pt-4 border-t border-border">
                      <Button className="w-full" onClick={() => handleViewDetails(event)}>
                        {t("buttons.view")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <CreateEventModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onEventCreated={handleEventCreated}
        />

        <EventDetailModal
          event={selectedEvent}
          open={showEventDetail}
          onOpenChange={setShowEventDetail}
        />
      </div>
    </div>
  );
};

export default Events;
