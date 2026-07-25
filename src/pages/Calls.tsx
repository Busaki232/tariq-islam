import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  Search,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VideoCallButton from "@/components/VideoCallButton";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

type CallLog = {
  id: string;
  caller_id: string;
  callee_id: string | null;
  conversation_id: string;
  call_type: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CallFilter = "all" | "missed" | "audio" | "video";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function formatCallDate(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== today.getFullYear()
        ? "numeric"
        : undefined,
  });
}

function formatCallTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Calls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [calls, setCalls] = useState<CallLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filter, setFilter] = useState<CallFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setCalls([]);
      setLoading(false);
      return;
    }

    let alive = true;

    const loadCalls = async () => {
      setLoading(true);

      try {
     const { data, error } = await supabase
       .from("call_invites")
      .select(
        "id, caller_id, callee_id, conversation_id, call_type, status, created_at, accepted_at, ended_at, ended_reason"
      )
       .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
       .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        const callRows = (data || []) as CallLog[];
        setCalls(callRows);

        const otherUserIds = Array.from(
          new Set(
            callRows
              .map((call) =>
                call.caller_id === user.id
                  ? call.receiver_id
                  : call.caller_id
              )
              .filter(Boolean)
          )
        );

        if (otherUserIds.length === 0) {
          setProfiles({});
          return;
        }

        const { data: profileRows, error: profileError } =
          await supabase
            .from("profiles")
            .select("user_id, full_name, username, avatar_url")
            .in("user_id", otherUserIds);

        if (profileError) {
          console.error(
            "[Calls] profile load failed:",
            profileError
          );
          return;
        }

        if (!alive) return;

        const profileMap: Record<string, Profile> = {};

        (profileRows || []).forEach((profile) => {
          profileMap[profile.user_id] = profile as Profile;
        });

        setProfiles(profileMap);
      } catch (error) {
        console.error("[Calls] load failed:", error);

        if (alive) {
          setCalls([]);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void loadCalls();

    return () => {
      alive = false;
    };
  }, [user?.id]);

 const getOtherUserId = (call: CallLog) =>
   call.caller_id === user?.id
     ? call.callee_id || ""
     : call.caller_id;

const getDirection = (
  call: CallLog
): "incoming" | "outgoing" | "missed" => {
  const isOutgoing = call.caller_id === user?.id;

  // A call made by the current user is always outgoing.
  if (isOutgoing) {
    return "outgoing";
  }

  const wasNeverAccepted = !call.accepted_at;

  const isMissed =
    call.status === "missed" ||
    call.status === "declined" ||
    (call.status === "ended" && wasNeverAccepted);

  if (isMissed) {
    return "missed";
  }

  return "incoming";
};

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calls.filter((call) => {
      const otherUserId = getOtherUserId(call);
      const profile = profiles[otherUserId];

      const name =
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "Unknown user";

      const direction = getDirection(call);
      const type =
        call.call_type === "video" ? "video" : "audio";

      const matchesFilter =
        filter === "all" ||
        (filter === "missed" && direction === "missed") ||
        (filter === "audio" && type === "audio") ||
        (filter === "video" && type === "video");

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        profile?.username?.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [calls, profiles, filter, search, user?.id]);

  const filters: Array<{
    value: CallFilter;
    label: string;
  }> = [
    {
      value: "all",
      label: t("callsPage.filters.all", {
        defaultValue: "All",
      }),
    },
    {
      value: "missed",
      label: t("callsPage.filters.missed", {
        defaultValue: "Missed",
      }),
    },
    {
      value: "audio",
      label: t("callsPage.filters.audio", {
        defaultValue: "Audio",
      }),
    },
    {
      value: "video",
      label: t("callsPage.filters.video", {
        defaultValue: "Video",
      }),
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
              aria-label={t("callsPage.back", {
                defaultValue: "Back",
              })}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("callsPage.title", {
                  defaultValue: "Calls",
                })}
              </h1>

              <p className="text-sm text-muted-foreground">
                {t("callsPage.subtitle", {
                  defaultValue:
                    "Your recent audio and video calls",
                })}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("callsPage.search", {
                defaultValue: "Search calls",
              })}
              className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={
                  filter === item.value
                    ? "shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
                    : "shrink-0 rounded-full border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border bg-background">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />

            <p className="mt-3 text-sm text-muted-foreground">
              {t("callsPage.loading", {
                defaultValue: "Loading calls...",
              })}
            </p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border bg-background px-6 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              {filter === "missed" ? (
                <PhoneMissed className="h-7 w-7 text-muted-foreground" />
              ) : (
                <Phone className="h-7 w-7 text-muted-foreground" />
              )}
            </div>

            <h2 className="mt-4 text-lg font-semibold">
              {search
                ? t("callsPage.noResults", {
                    defaultValue: "No calls found",
                  })
                : t("callsPage.noHistory", {
                    defaultValue: "No call history yet",
                  })}
            </h2>

            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {search
                ? t("callsPage.tryAnotherSearch", {
                    defaultValue:
                      "Try searching for another person.",
                  })
                : t("callsPage.noHistoryDescription", {
                    defaultValue:
                      "Your audio and video calls will appear here.",
                  })}
            </p>

            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" />
              {t("callsPage.openMessages", {
                defaultValue: "Open Messages",
              })}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCalls.map((call) => {
              const direction = getDirection(call);
              const isMissed = direction === "missed";
              const isOutgoing = direction === "outgoing";
              const isVideo = call.call_type === "video";

              const otherUserId = getOtherUserId(call);
              const profile = profiles[otherUserId];

              const name =
                profile?.full_name?.trim() ||
                profile?.username?.trim() ||
                t("callsPage.unknownUser", {
                  defaultValue: "Unknown user",
                });

              return (
                <article
                  key={call.id}
                  className="rounded-2xl border bg-background p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/profile/${otherUserId}`)
                      }
                      className="shrink-0 rounded-full"
                      aria-label={name}
                    >
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage
                          src={profile?.avatar_url || ""}
                          alt={name}
                        />

                        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/messages/${otherUserId}`)
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <div
                        className={
                          isMissed
                            ? "truncate font-semibold text-destructive"
                            : "truncate font-semibold text-foreground"
                        }
                      >
                        {name}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        {isMissed ? (
                          <PhoneMissed className="h-4 w-4 text-destructive" />
                        ) : isOutgoing ? (
                          <ArrowUpRight className="h-4 w-4 text-primary" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-primary" />
                        )}

                        <span
                          className={
                            isMissed
                              ? "text-destructive"
                              : undefined
                          }
                        >
                          {isMissed
                            ? t("callsPage.missed", {
                                defaultValue: "Missed",
                              })
                            : isOutgoing
                              ? t("callsPage.outgoing", {
                                  defaultValue: "Outgoing",
                                })
                              : t("callsPage.incoming", {
                                  defaultValue: "Incoming",
                                })}
                        </span>

                        <span>·</span>

                        <span>
                          {isVideo
                            ? t("callsPage.video", {
                                defaultValue: "Video",
                              })
                            : t("callsPage.audio", {
                                defaultValue: "Audio",
                              })}
                        </span>
                      </div>
                    </button>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-medium text-foreground">
                        {formatCallTime(call.created_at)}
                      </div>

                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatCallDate(call.created_at)}
                      </div>
                    </div>

               <VideoCallButton
                 conversationId={call.conversation_id}
                 calleeId={otherUserId}
                 calleeName={name}
                 callType={isVideo ? "video" : "audio"}
                 iconOnly
               />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}