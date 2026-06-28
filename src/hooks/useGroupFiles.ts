import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export const useGroupFiles = (groupId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ["group-files", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from("group_files")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({
      groupId,
      file,
      category,
      description,
      tags,
    }: {
      groupId: string;
      file: File;
      category?: string;
      description?: string;
      tags?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${groupId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("group-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("group-files")
        .getPublicUrl(filePath);

      // Insert file metadata
      const { data, error } = await supabase
        .from("group_files")
        .insert({
          group_id: groupId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileExt || "",
          file_size: file.size,
          mime_type: file.type,
          category: category || "other",
          description,
          tags,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "File uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["group-files"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("group_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "File deleted" });
      queryClient.invalidateQueries({ queryKey: ["group-files"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const incrementDownloadCount = useMutation({
    mutationFn: async (fileId: string) => {
      const { data: file } = await supabase
        .from("group_files")
        .select("download_count")
        .eq("id", fileId)
        .single();

      const { error } = await supabase
        .from("group_files")
        .update({ download_count: (file?.download_count || 0) + 1 })
        .eq("id", fileId);

      if (error) throw error;
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-files-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_files",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-files", groupId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  return {
    files,
    isLoading,
    uploadFile: uploadFile.mutate,
    deleteFile: deleteFile.mutate,
    downloadFile: incrementDownloadCount.mutate,
  };
};
