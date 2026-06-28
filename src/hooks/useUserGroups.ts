import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Group = {
  id: string;
  name: string | null;
  created_at: string;
  created_by: string;
  group_type?: string | null;
};

type State = {
  groups: Group[];
  loading: boolean;
  errorText: string;
  reload: () => Promise<void>;
};

function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export function useUserGroups(): State {
  const { user } = useAuth();
  const me = user?.id ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const load = useCallback(async () => {
    if (!me) {
      setGroups([]);
      setLoading(false);
      setErrorText("");
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      // Get my memberships + joined group rows
      const { data, error } = (await withTimeout(
        supabase
          .from("chat_group_members")
          .select("group_id, role, chat_groups(*)")
          .eq("user_id", me),
        15000
      )) as any;

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const parsed: Group[] = rows
        .map((r: any) => r.chat_groups)
        .filter(Boolean)
        .map((g: any) => ({
          id: String(g.id),
          name: g.name ?? null,
          created_at: g.created_at,
          created_by: g.created_by,
          group_type: g.group_type ?? null,
        }));

      // Deduplicate
      const map = new Map<string, Group>();
      for (const g of parsed) map.set(g.id, g);

      // Sort newest first
      const sorted = Array.from(map.values()).sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      );

      setGroups(sorted);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void load();
  }, [load]);

  return { groups, loading, errorText, reload: load };
}