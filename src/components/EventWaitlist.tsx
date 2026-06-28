import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WaitlistEntry {
  id: string;
  user_id: string;
  position: number;
  created_at: string;
  profile?: {
    full_name?: string;
  };
}

interface EventWaitlistProps {
  eventId: string;
  isOrganizer: boolean;
}

export const EventWaitlist = ({ eventId, isOrganizer }: EventWaitlistProps) => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWaitlist = async () => {
      try {
        const { data, error } = await supabase
          .from('event_waitlist')
          .select(`
            id,
            user_id,
            position,
            created_at,
            profiles:user_id (
              full_name
            )
          `)
          .eq('event_id', eventId)
          .order('position', { ascending: true });

        if (error) throw error;

        setWaitlist(data as any || []);
      } catch (error) {
        console.error('Error fetching waitlist:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWaitlist();

    // Real-time subscription
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
  }, [eventId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (waitlist.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No one on the waitlist yet
      </p>
    );
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {waitlist.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Badge variant="secondary" className="min-w-[2rem] justify-center">
            #{entry.position}
          </Badge>
          <Avatar>
            <AvatarFallback>
              {(entry.profile?.full_name || 'A')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {entry.profile?.full_name || 'Anonymous'}
            </p>
            {isOrganizer && (
              <p className="text-xs text-muted-foreground">
                Joined {new Date(entry.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
