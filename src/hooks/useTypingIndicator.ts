import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TypingUser {
  user_id: string;
  user_name: string;
}

export const useTypingIndicator = (roomId: string) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const typingChannel = supabase.channel(`typing-${roomId}`);

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const typing = Object.values(state).flat().filter((item: any) => item.user_id && item.user_name) as unknown as TypingUser[];
        // Filter out current user
        setTypingUsers(typing.filter(u => u.user_id !== user.id));
      })
      .subscribe();

    setChannel(typingChannel);

    return () => {
      typingChannel.unsubscribe();
    };
  }, [roomId, user]);

  const startTyping = useCallback(async () => {
    if (!channel || !user) return;

    await channel.track({
      user_id: user.id,
      user_name: user.email?.split('@')[0] || 'User'
    });
  }, [channel, user]);

  const stopTyping = useCallback(async () => {
    if (!channel) return;
    await channel.untrack();
  }, [channel]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
};
