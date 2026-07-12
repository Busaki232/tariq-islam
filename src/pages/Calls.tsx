import { useEffect, useState } from "react";
import { Phone, Video, ArrowUpRight, ArrowDownLeft, PhoneMissed, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Calls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<any[]>([]);
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!user?.id) return;

    const loadCalls = async () => {
      const { data } = await (supabase as any)
        .from("call_logs")
        .select("*")
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("started_at", { ascending: false });

      setCalls(data || []);
    };

    void loadCalls();
  }, [user?.id]);

  const getOtherUserId = (call: any) =>
    call.caller_id === user?.id ? call.receiver_id : call.caller_id;

  const getDirection = (call: any) => {
    if (call.status === "missed") return "Missed";
    return call.caller_id === user?.id ? "Outgoing" : "Incoming";
  };

  return (
    <div className="p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 text-sm text-muted-foreground"
      >
        ← {t("callsPage.back")}
      </button>

      <h1 className="mb-4 text-3xl font-bold">
        {t("callsPage.title")}
      </h1>

      <div className="space-y-1">
        {calls.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            {t("callsPage.noHistory")}
          </div>
        ) : (
          calls.map((call) => {
            const direction = getDirection(call);
            const isMissed = direction === "Missed";
            const isOutgoing = direction === "Outgoing";
            const otherUserId = getOtherUserId(call);

            return (
              <div
                key={call.id}
                className="flex items-center gap-3 border-b py-3"
              >
                <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center">
                  {call.call_type === "video" ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/messages/${otherUserId}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className={isMissed ? "font-semibold text-red-600 truncate" : "font-semibold truncate"}>
                    {otherUserId || "Unknown user"}
                  </div>

                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {isMissed ? (
                      <PhoneMissed className="h-4 w-4" />
                    ) : isOutgoing ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                    {direction} {call.call_type}
                  </div>
                </button>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">
                    {new Date(call.started_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${otherUserId}`)}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
                  >
                    <Info className="h-3 w-3" />
                    {t("callsPage.callBack")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}