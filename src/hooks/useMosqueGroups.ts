import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useMosqueGroups = (mosqueId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mosqueGroups, isLoading } = useQuery({
    queryKey: ["mosque-groups", mosqueId],
    queryFn: async () => {
      if (!mosqueId) return [];
      
      const { data, error } = await supabase
        .from("mosque_groups")
        .select(`
          *,
          chat_groups (
            id,
            name,
            description,
            avatar_url,
            group_type,
            created_at
          )
        `)
        .eq("mosque_id", mosqueId);

      if (error) throw error;
      return data;
    },
    enabled: !!mosqueId,
  });

  const linkGroupToMosque = useMutation({
    mutationFn: async ({ groupId, mosqueId }: { groupId: string; mosqueId: string }) => {
      const { data, error } = await supabase
        .from("mosque_groups")
        .insert({ group_id: groupId, mosque_id: mosqueId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Group linked to mosque successfully" });
      queryClient.invalidateQueries({ queryKey: ["mosque-groups"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to link group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMosqueGroup = useMutation({
    mutationFn: async (mosqueGroupId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("mosque_groups")
        .update({
          is_verified: true,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", mosqueGroupId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Group verified successfully" });
      queryClient.invalidateQueries({ queryKey: ["mosque-groups"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to verify group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    mosqueGroups,
    isLoading,
    linkGroupToMosque: linkGroupToMosque.mutate,
    verifyMosqueGroup: verifyMosqueGroup.mutate,
  };
};
