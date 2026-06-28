// src/pages/ProfileConnections.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ProfileConnectionsProps = {
  type: "followers" | "following";
};

type ProfileItem = {
  user_id: string;
  full_name: string | null;
  location: string | null;
  avatar_url: string | null;
};

export default function ProfileConnections({ type }: ProfileConnectionsProps) {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();

  const profileUserId = userId || user?.id || "";

  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<ProfileItem[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadPeople() {
      if (!profileUserId) return;

      setLoading(true);

      try {
        const column = type === "followers" ? "receiver_id" : "requester_id";
        const otherColumn = type === "followers" ? "requester_id" : "receiver_id";

        const { data: connections, error: connError } = await supabase
          .from("user_connections")
          .select("requester_id, receiver_id, status")
          .eq("status", "accepted")
          .eq(column, profileUserId);

        if (connError) throw connError;

        const ids = Array.from(
          new Set(
            (connections || [])
              .map((c: any) => c[otherColumn])
              .filter(Boolean)
          )
        );

        if (ids.length === 0) {
          if (alive) setPeople([]);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, full_name, location, avatar_url")
          .in("user_id", ids);

        if (profileError) throw profileError;

        if (alive) setPeople((profiles || []) as ProfileItem[]);
      } catch (error) {
        console.error("[ProfileConnections] failed:", error);
        if (alive) setPeople([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadPeople();

    return () => {
      alive = false;
    };
  }, [profileUserId, type]);

  return (
    <div className="p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <h1 className="text-xl font-semibold mb-4">
        {type === "followers" ? "Followers" : "Following"}
      </h1>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : people.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          No {type === "followers" ? "followers" : "following"} yet.
        </div>
      ) : (
        <div className="divide-y rounded-xl border overflow-hidden">
          {people.map((person) => {
            const name = person.full_name || "Unnamed User";

            return (
              <div
                key={person.user_id}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/profile/${person.user_id}`)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {person.location || "Location not set"}
                    </div>
                  </div>
                </button>

                {type === "followers" && profileUserId === user?.id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm("Remove this follower?");
                      if (!ok) return;

                      const { error } = await supabase
                        .from("user_connections")
                        .delete()
                        .eq("requester_id", person.user_id)
                        .eq("receiver_id", profileUserId);

                      if (!error) {
                        setPeople((prev) =>
                          prev.filter((p) => p.user_id !== person.user_id)
                        );
                      }
                    }}
                    className="ml-3 rounded-lg border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Remove
                  </button>
                ) : null}

                {type === "following" && profileUserId === user?.id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm("Unfollow this user?");
                      if (!ok) return;

                      const { error } = await supabase
                        .from("user_connections")
                        .delete()
                        .eq("requester_id", profileUserId)
                        .eq("receiver_id", person.user_id);

                      if (!error) {
                        setPeople((prev) =>
                          prev.filter((p) => p.user_id !== person.user_id)
                        );
                      }
                    }}
                    className="ml-3 rounded-lg border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Unfollow
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}