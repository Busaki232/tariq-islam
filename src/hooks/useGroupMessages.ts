import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface GroupMessage {
  id: string;
  sender_id: string;
  group_id: string;
  content: string;
  message_type: string;
  created_at: string;
  edited_at?: string;
  is_deleted: boolean;
  sender_name?: string;
  sender_location?: string;
  reactions?: Record<string, string[]>;
}

export const useGroupMessages = (groupId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupId || !user) {
      setMessages([]);
      return;
    }

    loadMessages();
    updateLastRead();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          loadSingleMessage(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id ? { ...msg, ...payload.new, reactions: payload.new.reactions } : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [groupId, user]);

  const loadMessages = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, location')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles = (data || []).map(msg => {
        const profile = profileMap.get(msg.sender_id);
        return {
          ...msg,
          sender_name: profile?.full_name || 'Unknown User',
          sender_location: profile?.location,
          reactions: (msg.reactions as Record<string, string[]>) || {}
        };
      });

      setMessages(messagesWithProfiles as GroupMessage[]);
    } catch (error: any) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadSingleMessage = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error) throw error;

      // Fetch sender profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, location')
        .eq('user_id', data.sender_id)
        .single();

      const messageWithProfile = {
        ...data,
        sender_name: profile?.full_name || 'Unknown User',
        sender_location: profile?.location,
        reactions: (data.reactions as Record<string, string[]>) || {}
      };

      setMessages(prev => [...prev, messageWithProfile as GroupMessage]);
    } catch (error) {
      // Silently fail for single message loads
    }
  };

  const sendMessage = async (content: string, messageType: string = 'text') => {
    if (!groupId || !user) return { success: false };

    try {
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          group_id: groupId,
          content,
          message_type: messageType
        })
        .select('id')
        .single();

      if (error) throw error;

      // Get group members to send push notifications
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .neq('user_id', user.id); // Exclude sender

      // Send push notifications to group members
      if (members && members.length > 0 && messageData) {
        const { data: groupData } = await supabase
          .from('chat_groups')
          .select('name')
          .eq('id', groupId)
          .single();

        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();

        supabase.functions.invoke('send-push-notification', {
          body: {
            userIds: members.map(m => m.user_id),
            title: `${senderProfile?.full_name || 'Someone'} in ${groupData?.name || 'Group'}`,
            body: content.length > 100 ? content.substring(0, 100) + '...' : content,
            data: {
              type: 'group_message',
              groupId,
              messageId: messageData.id,
              url: `/chat?group=${groupId}`,
            },
            actions: [
              { action: 'reply', title: 'Reply' },
            ],
            priority: 2,
          },
        }).catch(err => console.error('Failed to send push notification:', err));
      }

      updateLastRead();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
      return { success: false, error };
    }
  };

  const updateLastRead = useCallback(async () => {
    if (!groupId || !user) return;

    try {
      await supabase
        .from('group_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('group_id', groupId)
        .eq('user_id', user.id);
    } catch (error) {
      // Silently fail
    }
  }, [groupId, user]);

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId);

      if (error) throw error;
      
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message deleted');
      return { success: true };
    } catch (error: any) {
      toast.error('Failed to delete message');
      return { success: false, error };
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    refetch: loadMessages
  };
};
