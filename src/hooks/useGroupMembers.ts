import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  last_read_at?: string;
  is_muted: boolean;
  full_name?: string;
  location?: string;
  avatar_url?: string;
}

export const useGroupMembers = (groupId: string | null) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      return;
    }

    loadMembers();

    // Subscribe to member changes
    const membersChannel = supabase
      .channel(`group-members-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
    };
  }, [groupId]);

  const loadMembers = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            location,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;

      const membersWithProfiles = (data || []).map(member => ({
        ...member,
        full_name: member.profiles?.full_name,
        location: member.profiles?.location,
        avatar_url: member.profiles?.avatar_url
      }));

      setMembers(membersWithProfiles);
    } catch (error: any) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (userId: string, role: 'admin' | 'moderator' | 'member' = 'member') => {
    if (!groupId) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role
        });

      if (error) throw error;
      toast.success('Member added successfully');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add member');
      return { success: false, error };
    }
  };

  const addMembers = async (userIds: string[], role: 'admin' | 'moderator' | 'member' = 'member') => {
    if (!groupId || userIds.length === 0) return { success: false };

    try {
      const membersToAdd = userIds.map(userId => ({
        group_id: groupId,
        user_id: userId,
        role
      }));

      const { error } = await supabase
        .from('group_members')
        .insert(membersToAdd);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add members');
      return { success: false, error };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member removed successfully');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
      return { success: false, error };
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'moderator' | 'member') => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member role updated');
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
      return { success: false, error };
    }
  };

  return {
    members,
    loading,
    addMember,
    addMembers,
    removeMember,
    updateMemberRole,
    refetch: loadMembers
  };
};
