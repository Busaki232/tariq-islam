import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Attendee {
  id: string;
  user_id: string;
  status: string;
  notes?: string;
  check_in_time?: string;
  profile?: {
    full_name?: string;
  };
}

interface EventAttendeeListProps {
  eventId: string;
  isOrganizer: boolean;
}

export const EventAttendeeList = ({ eventId, isOrganizer }: EventAttendeeListProps) => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        const { data, error } = await supabase
          .from('event_rsvps')
          .select(`
            id,
            user_id,
            status,
            notes,
            check_in_time,
            profiles:user_id (
              full_name
            )
          `)
          .eq('event_id', eventId)
          .eq('status', 'attending');

        if (error) throw error;

        setAttendees(data as any || []);
      } catch (error) {
        console.error('Error fetching attendees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();

    // Real-time subscription
    const channel = supabase
      .channel(`attendees-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          fetchAttendees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const filteredAttendees = attendees.filter(attendee => {
    const name = attendee.profile?.full_name || 'Anonymous';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search attendees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredAttendees.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attendees found
        </p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {filteredAttendees.map((attendee) => (
            <div key={attendee.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Avatar>
                <AvatarFallback>
                  {(attendee.profile?.full_name || 'A')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {attendee.profile?.full_name || 'Anonymous'}
                  </p>
                  {attendee.check_in_time && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Checked in
                    </Badge>
                  )}
                </div>
                {isOrganizer && attendee.notes && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {attendee.notes}
                  </p>
                )}
                {isOrganizer && attendee.check_in_time && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Checked in at {new Date(attendee.check_in_time).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
