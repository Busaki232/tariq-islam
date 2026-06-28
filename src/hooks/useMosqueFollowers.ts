import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export const useMosqueFollowers = (mosqueId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followerCount, isLoading: isLoadingCount } = useQuery({
    queryKey: ["mosque-followers-count", mosqueId],
    queryFn: async () => {
      if (!mosqueId) return 0;
      
      const { count, error } = await supabase
        .from("mosque_followers")
        .select("*", { count: "exact", head: true })
        .eq("mosque_id", mosqueId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!mosqueId,
  });

  const { data: isFollowing, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ["is-following", mosqueId],
    queryFn: async () => {
      if (!mosqueId) return false;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("mosque_followers")
        .select("id")
        .eq("mosque_id", mosqueId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!mosqueId,
  });

  const followMosque = useMutation({
    mutationFn: async ({ mosqueId, autoJoinGroups = true }: { mosqueId: string; autoJoinGroups?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("mosque_followers")
        .insert({
          user_id: user.id,
          mosque_id: mosqueId,
          auto_join_groups: autoJoinGroups,
        })
        .select()
        .single();

      if (error) throw error;

      // If auto-join is enabled, join all verified mosque groups
      if (autoJoinGroups) {
        const { data: mosqueGroups } = await supabase
          .from("mosque_groups")
          .select("group_id")
          .eq("mosque_id", mosqueId)
          .eq("is_verified", true);

        if (mosqueGroups && mosqueGroups.length > 0) {
          const groupMemberships = mosqueGroups.map(mg => ({
            user_id: user.id,
            group_id: mg.group_id,
            role: "member" as const,
          }));

          await supabase.from("group_members").insert(groupMemberships);
        }
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: "Following mosque" });
      queryClient.invalidateQueries({ queryKey: ["mosque-followers-count"] });
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to follow mosque",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unfollowMosque = useMutation({
    mutationFn: async (mosqueId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("mosque_followers")
        .delete()
        .eq("mosque_id", mosqueId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Unfollowed mosque" });
      queryClient.invalidateQueries({ queryKey: ["mosque-followers-count"] });
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unfollow mosque",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Real-time subscription for follower count
  useEffect(() => {
    if (!mosqueId) return;

    const channel = supabase
      .channel(`mosque-followers-${mosqueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mosque_followers",
          filter: `mosque_id=eq.${mosqueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mosque-followers-count", mosqueId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mosqueId, queryClient]);

  return {
    followerCount,
    isFollowing,
    isLoading: isLoadingCount || isLoadingFollowing,
    followMosque: followMosque.mutate,
    unfollowMosque: unfollowMosque.mutate,
  };
};
