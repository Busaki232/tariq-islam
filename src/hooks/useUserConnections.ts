// src/hooks/useUserConnections.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type FriendStatus = "pending" | "accepted" | "declined" | "blocked" | string;

type FriendshipRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
};
export type ProfileLite = {
  user_id: string;
  full_name: string | null;
  username?: string | null;
  location?: string | null;
  avatar_url: string | null;
};

export type PendingSentItem = {
  id: string;
  receiver_id: string;
  created_at: string;
  status: FriendStatus;
  other: ProfileLite;
};

export type PendingReceivedItem = {
  id: string;
  requester_id: string;
  created_at: string;
  status: FriendStatus;
  other: ProfileLite;
};

const fallbackProfile = (user_id: string): ProfileLite => ({
  user_id,
  full_name: null,
  username: null,
  location: null,
  avatar_url: null,
});

export function useUserConnections() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [connectedUsers, setConnectedUsers] = useState<ProfileLite[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingSentItem[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingReceivedItem[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setConnectedUsers([]);
      setPendingSent([]);
      setPendingReceived([]);
      setErrorText(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      const { data: rows, error } = await supabase
        .from("user_connections")
        .select("id, requester_id, receiver_id, status, created_at, updated_at")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const friendships = (rows || []) as FriendshipRow[];

      const otherIds = new Set<string>();
      for (const r of friendships) {
        const other = r.requester_id === user.id ? r.receiver_id : r.requester_id;
        if (other) otherIds.add(other);
      }

      const profileMap: Record<string, ProfileLite> = {};

      if (otherIds.size > 0) {
        const ids = Array.from(otherIds);
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, location, avatar_url")
          .in("user_id", ids)
          .limit(1000);

        if (!pErr && profs) {
          for (const p of profs as any[]) {
            if (p?.user_id) profileMap[p.user_id] = p as ProfileLite;
          }
        }
      }

      const nextConnected: ProfileLite[] = [];
      const nextSent: PendingSentItem[] = [];
      const nextReceived: PendingReceivedItem[] = [];

      for (const r of friendships) {
        const iAmRequester = r.requester_id === user.id;
        const otherId = iAmRequester ? r.receiver_id : r.requester_id;
        const other = profileMap[otherId] ?? fallbackProfile(otherId);
        const status = (r.status || "pending") as FriendStatus;

        if (status === "accepted") {
          nextConnected.push(other);
          continue;
        }

        if (status === "pending") {
          if (iAmRequester) {
            nextSent.push({
              id: r.id,
              receiver_id: otherId,
              created_at: r.created_at,
              status,
              other,
            });
          } else {
            nextReceived.push({
              id: r.id,
              requester_id: otherId,
              created_at: r.created_at,
              status,
              other,
            });
          }
        }
      }

      const seenConnected = new Set<string>();
      const dedupedConnected = nextConnected.filter((p) => {
        if (!p?.user_id) return false;
        if (seenConnected.has(p.user_id)) return false;
        seenConnected.add(p.user_id);
        return true;
      });

      const seenSent = new Set<string>();
      const dedupedSent = nextSent.filter((r) => {
        if (!r.receiver_id) return false;
        if (seenSent.has(r.receiver_id)) return false;
        seenSent.add(r.receiver_id);
        return true;
      });

      const seenReceived = new Set<string>();
      const dedupedReceived = nextReceived.filter((r) => {
        if (!r.requester_id) return false;
        if (seenReceived.has(r.requester_id)) return false;
        seenReceived.add(r.requester_id);
        return true;
      });

      setConnectedUsers(dedupedConnected);
      setPendingSent(dedupedSent);
      setPendingReceived(dedupedReceived);
      setErrorText(null);
    } catch (e: any) {
      console.warn("[useUserConnections] load failed", e);
      setConnectedUsers([]);
      setPendingSent([]);
      setPendingReceived([]);
      setErrorText(e?.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const sendConnectionRequest = useCallback(
    async (targetUserId: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!targetUserId) throw new Error("Missing target user id");
      if (targetUserId === user.id) throw new Error("You can’t invite yourself.");

      const { data: existing, error: existingError } = await supabase
        .from("user_connections")
        .select("id, requester_id, receiver_id, status")
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.status === "accepted") {
        throw new Error("You are already connected.");
      }

      if (existing?.status === "pending") {
        if (existing.requester_id === user.id) {
          throw new Error("You already sent this user a request.");
        }

        if (existing.requester_id === targetUserId) {
          throw new Error("This user already sent you a request.");
        }
      }

      if (existing?.status === "declined") {
        const { error: reviveError } = await supabase
          .from("user_connections")
          .update({
            requester_id: user.id,
            receiver_id: targetUserId,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (reviveError) throw reviveError;

        await load();
        return;
      }

      const { error } = await supabase.from("user_connections").insert({
        requester_id: user.id,
        receiver_id: targetUserId,
        status: "pending",
      });

      if (error) throw error;

      await load();
    },
    [user?.id, load]
  );

  const acceptConnectionRequest = useCallback(
    async (friendshipId: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!friendshipId) throw new Error("Missing request id");

      const { error } = await supabase
        .from("user_connections")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", friendshipId);

      if (error) throw error;

      await load();
    },
    [user?.id, load]
  );

  const rejectConnectionRequest = useCallback(
    async (friendshipId: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!friendshipId) throw new Error("Missing request id");

      const { error } = await supabase
        .from("user_connections")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("id", friendshipId);

      if (error) throw error;

      await load();
    },
    [user?.id, load]
  );

  const cancelSentRequest = useCallback(
    async (friendshipId: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!friendshipId) throw new Error("Missing request id");

      const { error } = await supabase
        .from("user_connections")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;

      await load();
    },
    [user?.id, load]
  );

  const counts = useMemo(
    () => ({
      connected: connectedUsers.length,
      pendingSent: pendingSent.length,
      pendingReceived: pendingReceived.length,
    }),
    [connectedUsers.length, pendingSent.length, pendingReceived.length]
  );

  return useMemo(
    () => ({
      connectedUsers,
      pendingReceived,
      pendingSent,
      loading,
      errorText,
      counts,

      sendConnectionRequest,

      acceptConnectionRequest,
      rejectConnectionRequest,
      cancelSentRequest,

      // aliases for older callers in the app
      acceptRequest: acceptConnectionRequest,
      declineRequest: rejectConnectionRequest,

      reload,
    }),
    [
      connectedUsers,
      pendingReceived,
      pendingSent,
      loading,
      errorText,
      counts,
      sendConnectionRequest,
      acceptConnectionRequest,
      rejectConnectionRequest,
      cancelSentRequest,
      reload,
    ]
  );
}