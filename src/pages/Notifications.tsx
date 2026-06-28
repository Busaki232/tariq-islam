import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadNotifications() {
      if (!user?.id) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && alive) {
        setNotifications((data || []) as NotificationRow[]);
      }

      if (alive) setLoading(false);
    }

    void loadNotifications();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const openNotification = async (n: NotificationRow) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", n.id);

if (n.type === "follow_request") {
  navigate("/requests");
  return;
}

if (n.type === "follow_accepted" && n.actor_id) {
  navigate(`/profile/${n.actor_id}`);
  return;
}

if (n.actor_id) {
  navigate(`/profile/${n.actor_id}`);
}
};
  const markAllRead = async () => {
    if (!user?.id) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read_at: n.read_at || new Date().toISOString(),
      }))
    );
  };

  return (
    <div className="p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>

        <button
          type="button"
          onClick={() => void markAllRead()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Mark all read
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          No notifications yet.
        </div>
      ) : (
        <div className="divide-y rounded-xl border overflow-hidden">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void openNotification(n)}
              className="w-full px-4 py-3 text-left hover:bg-muted/50"
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-1 h-2 w-2 rounded-full",
                    n.read_at ? "bg-transparent" : "bg-red-600",
                  ].join(" ")}
                />

                <div className="min-w-0 flex-1">
                  <div className="font-medium">{n.title}</div>
                  {n.body && (
                    <div className="text-sm text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}