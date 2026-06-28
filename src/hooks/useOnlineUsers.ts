// src/hooks/useOnlineUsers.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PresenceState = Record<string, Array<{ user_id: string }>>;

export function useOnlineUsers() {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channelRef.current = channel;

    const updateFromPresence = (state: PresenceState) => {
      const ids = new Set<string>();

      // presence state is a map of key -> array of metas
      for (const metas of Object.values(state)) {
        for (const meta of metas) {
          if (meta?.user_id) ids.add(meta.user_id);
        }
      }

      setOnlineIds(ids);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        updateFromPresence(state);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id });
          const state = channel.presenceState() as PresenceState;
          updateFromPresence(state);
        }
      });

    return () => {
      try {
        channel.untrack();
      } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  return useMemo(() => {
    return {
      isOnline: (userId: string | null | undefined) =>
        !!userId && onlineIds.has(userId),
      onlineIds,
      onlineCount: onlineIds.size,
    };
  }, [onlineIds]);
}