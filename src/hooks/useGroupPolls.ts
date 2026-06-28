import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export const useGroupPolls = (groupId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: polls, isLoading } = useQuery({
    queryKey: ["group-polls", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from("group_polls")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const createPoll = useMutation({
    mutationFn: async ({
      groupId,
      question,
      options,
      pollType = "single",
      isAnonymous = false,
      closesAt,
    }: {
      groupId: string;
      question: string;
      options: string[];
      pollType?: string;
      isAnonymous?: boolean;
      closesAt?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const pollOptions: PollOption[] = options.map((text, index) => ({
        id: `opt_${index}`,
        text,
        votes: 0,
      }));

      const { data, error } = await supabase
        .from("group_polls")
        .insert({
          group_id: groupId,
          question,
          options: pollOptions as any,
          poll_type: pollType,
          is_anonymous: isAnonymous,
          closes_at: closesAt,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Poll created successfully" });
      queryClient.invalidateQueries({ queryKey: ["group-polls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create poll",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const votePoll = useMutation({
    mutationFn: async ({ pollId, optionIds }: { pollId: string; optionIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert vote
      const { error: voteError } = await supabase
        .from("group_poll_votes")
        .upsert({
          poll_id: pollId,
          user_id: user.id,
          option_ids: optionIds,
        });

      if (voteError) throw voteError;

      // Update poll options vote count
      const { data: poll } = await supabase
        .from("group_polls")
        .select("*")
        .eq("id", pollId)
        .single();

      if (poll) {
        const { data: votes } = await supabase
          .from("group_poll_votes")
          .select("option_ids")
          .eq("poll_id", pollId);

        const optionCounts: Record<string, number> = {};
        votes?.forEach(vote => {
          vote.option_ids?.forEach(optId => {
            optionCounts[optId] = (optionCounts[optId] || 0) + 1;
          });
        });

        const updatedOptions = (poll.options as any as PollOption[]).map(opt => ({
          ...opt,
          votes: optionCounts[opt.id] || 0,
        }));

        const { error: updateError } = await supabase
          .from("group_polls")
          .update({ options: updatedOptions as any })
          .eq("id", pollId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-polls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closePoll = useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase
        .from("group_polls")
        .update({ closes_at: new Date().toISOString() })
        .eq("id", pollId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Poll closed" });
      queryClient.invalidateQueries({ queryKey: ["group-polls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to close poll",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-polls-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_polls",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-polls", groupId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  return {
    polls,
    isLoading,
    createPoll: createPoll.mutate,
    votePoll: votePoll.mutate,
    closePoll: closePoll.mutate,
  };
};
