import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

type RSVPStatus = 'attending' | 'maybe' | 'not_attending';

interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: RSVPStatus;
  created_at: string;
  rsvp_date: string;
  notes?: string;
}

export const useEventRSVP = (eventId: string) => {
  const { user } = useAuth();
  const [rsvp, setRsvp] = useState<RSVP | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchRSVP = useCallback(async () => {
    if (!user || !eventId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setRsvp(data as RSVP | null);
    } catch (error) {
      console.error('Error fetching RSVP:', error);
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  const fetchAttendeeCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('event_rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'attending');

      if (error) throw error;
      setAttendeeCount(count || 0);
    } catch (error) {
      console.error('Error fetching attendee count:', error);
    }
  }, [eventId]);

  useEffect(() => {
    fetchRSVP();
    fetchAttendeeCount();

    // Subscribe to real-time RSVP updates
    const channel = supabase
      .channel(`rsvps-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          fetchRSVP();
          fetchAttendeeCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRSVP, fetchAttendeeCount, eventId]);

  const createOrUpdateRSVP = useCallback(async (status: RSVPStatus, notes?: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to RSVP',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .upsert({
          event_id: eventId,
          user_id: user.id,
          status,
          notes
        }, {
          onConflict: 'event_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;

      setRsvp(data as RSVP);
      await fetchAttendeeCount();

      toast({
        title: 'RSVP Updated',
        description: `You are marked as ${status.replace('_', ' ')}`
      });
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast({
        title: 'Error',
        description: 'Failed to update RSVP',
        variant: 'destructive'
      });
    }
  }, [user, eventId, fetchAttendeeCount]);

  const cancelRSVP = useCallback(async () => {
    if (!user || !rsvp) return;

    try {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('id', rsvp.id);

      if (error) throw error;

      setRsvp(null);
      await fetchAttendeeCount();

      toast({
        title: 'RSVP Cancelled',
        description: 'Your RSVP has been removed'
      });
    } catch (error) {
      console.error('Error cancelling RSVP:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel RSVP',
        variant: 'destructive'
      });
    }
  }, [user, rsvp, fetchAttendeeCount]);

  return {
    rsvp,
    attendeeCount,
    loading,
    createOrUpdateRSVP,
    cancelRSVP,
    hasRSVP: !!rsvp
  };
};
