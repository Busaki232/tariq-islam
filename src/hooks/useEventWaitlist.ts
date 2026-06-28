import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface WaitlistEntry {
  id: string;
  event_id: string;
  user_id: string;
  position: number;
  created_at: string;
  notified_at?: string;
}

export const useEventWaitlist = (eventId: string) => {
  const { user } = useAuth();
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchWaitlist = useCallback(async () => {
    if (!eventId) return;

    try {
      // Get user's waitlist entry if exists
      if (user) {
        const { data: entry } = await supabase
          .from('event_waitlist')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        setWaitlistEntry(entry);
      }

      // Get total waitlist count
      const { count } = await supabase
        .from('event_waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

      setWaitlistCount(count || 0);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => {
    fetchWaitlist();

    // Subscribe to real-time waitlist updates
    const channel = supabase
      .channel(`waitlist-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_waitlist',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          fetchWaitlist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWaitlist, eventId]);

  const joinWaitlist = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to join the waitlist');
      return;
    }

    try {
      // Get next position
      const { count } = await supabase
        .from('event_waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

      const nextPosition = (count || 0) + 1;

      const { error } = await supabase
        .from('event_waitlist')
        .insert({
          event_id: eventId,
          user_id: user.id,
          position: nextPosition
        });

      if (error) throw error;

      toast.success(`You're #${nextPosition} on the waitlist`);
      await fetchWaitlist();
    } catch (error) {
      console.error('Error joining waitlist:', error);
      toast.error('Failed to join waitlist');
    }
  }, [user, eventId, fetchWaitlist]);

  const leaveWaitlist = useCallback(async () => {
    if (!user || !waitlistEntry) return;

    try {
      const { error } = await supabase
        .from('event_waitlist')
        .delete()
        .eq('id', waitlistEntry.id);

      if (error) throw error;

      toast.success('Removed from waitlist');
      await fetchWaitlist();
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      toast.error('Failed to leave waitlist');
    }
  }, [user, waitlistEntry, fetchWaitlist]);

  return {
    waitlistEntry,
    waitlistCount,
    loading,
    joinWaitlist,
    leaveWaitlist,
    isOnWaitlist: !!waitlistEntry,
    position: waitlistEntry?.position
  };
};
