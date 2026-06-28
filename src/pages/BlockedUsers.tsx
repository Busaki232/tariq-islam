import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BlockRow = {
  id: string;
  blocked_user_id: string;
  created_at: string;
  blocked?: { full_name?: string | null; avatar_url?: string | null } | null;
};

export default function BlockedUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("blocked_users")
      .select("id, blocked_user_id, created_at, blocked:blocked_user_id(full_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unblock = async (id: string) => {
    await supabase.from("blocked_users").delete().eq("id", id);
    await load();
  };

  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-semibold">Blocked users</h1>

      {loading ? (
        <div className="mt-6 text-sm text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-muted-foreground">No blocked users.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {r.blocked?.full_name ?? r.blocked_user_id}
                </div>
                <div className="text-xs text-muted-foreground">
                  Blocked {new Date(r.created_at).toLocaleString()}
                </div>
              </div>

              <button
                className="shrink-0 rounded-lg border px-3 py-2 text-sm"
                type="button"
                onClick={() => void unblock(r.id)}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}