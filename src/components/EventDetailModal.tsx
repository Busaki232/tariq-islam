import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEventRSVP } from "@/hooks/useEventRSVP";
import { useEventWaitlist } from "@/hooks/useEventWaitlist";
import { EventAttendeeList } from "./EventAttendeeList";
import { EventWaitlist } from "./EventWaitlist";

interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  category: string;
  attendees_count: number;
  max_attendees?: number;
  image_url?: string;
  organizer_id: string;
}

interface EventDetailModalProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventDetailModal = ({ event, open, onOpenChange }: EventDetailModalProps) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [showAttendees, setShowAttendees] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  const { rsvp, attendeeCount, loading, createOrUpdateRSVP, cancelRSVP } = useEventRSVP(event?.id || '');
  const { waitlistEntry, waitlistCount, joinWaitlist, leaveWaitlist } = useEventWaitlist(event?.id || '');

  if (!event) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isFull = event.max_attendees ? attendeeCount >= event.max_attendees : false;
  const capacityPercentage = event.max_attendees ? (attendeeCount / event.max_attendees) * 100 : 0;
  const isOrganizer = user?.id === event.organizer_id;

  const handleRSVP = async (status: 'attending' | 'maybe' | 'not_attending') => {
    await createOrUpdateRSVP(status, notes);
    setNotes("");
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      religious: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      educational: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      cultural: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      social: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      general: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {event.image_url && (
            <div className="w-full h-64 rounded-lg overflow-hidden">
              <img 
                src={event.image_url} 
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge className={getCategoryColor(event.category)}>
              {event.category}
            </Badge>
            {rsvp && (
              <Badge variant="outline">
                {rsvp.status === 'attending' ? 'You are attending' : 
                 rsvp.status === 'maybe' ? 'You might attend' : 
                 'Not attending'}
              </Badge>
            )}
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <p>{event.description}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{formatDate(event.event_date)}</span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{formatTime(event.event_time)}</span>
            </div>
            <div className="flex items-center text-sm">
              <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>
                {attendeeCount} attending
                {event.max_attendees && ` / ${event.max_attendees} max`}
              </span>
            </div>
          </div>

          {event.max_attendees && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Capacity</span>
                <span className={isFull ? "text-destructive" : "text-muted-foreground"}>
                  {capacityPercentage.toFixed(0)}% full
                </span>
              </div>
              <Progress value={capacityPercentage} />
            </div>
          )}

          {user && !loading && (
            <div className="space-y-4">
              {!isFull && (
                <>
                  <Textarea
                    placeholder="Add a note with your RSVP (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleRSVP('attending')}
                      variant={rsvp?.status === 'attending' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      Attending
                    </Button>
                    <Button 
                      onClick={() => handleRSVP('maybe')}
                      variant={rsvp?.status === 'maybe' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      Maybe
                    </Button>
                    <Button 
                      onClick={() => handleRSVP('not_attending')}
                      variant={rsvp?.status === 'not_attending' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      Not Attending
                    </Button>
                  </div>
                </>
              )}

              {rsvp && (
                <Button onClick={cancelRSVP} variant="ghost" className="w-full">
                  Cancel RSVP
                </Button>
              )}

              {isFull && !rsvp && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    This event is at full capacity
                  </p>
                  {!waitlistEntry ? (
                    <Button onClick={joinWaitlist} variant="outline" className="w-full">
                      Join Waitlist ({waitlistCount} waiting)
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-center">
                        You're #{waitlistEntry.position} on the waitlist
                      </p>
                      <Button onClick={leaveWaitlist} variant="ghost" className="w-full">
                        Leave Waitlist
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={() => setShowAttendees(!showAttendees)} 
              variant="outline"
              className="flex-1"
            >
              {showAttendees ? 'Hide' : 'View'} Attendees ({attendeeCount})
            </Button>
            {waitlistCount > 0 && (
              <Button 
                onClick={() => setShowWaitlist(!showWaitlist)} 
                variant="outline"
                className="flex-1"
              >
                {showWaitlist ? 'Hide' : 'View'} Waitlist ({waitlistCount})
              </Button>
            )}
          </div>

          {showAttendees && (
            <EventAttendeeList eventId={event.id} isOrganizer={isOrganizer} />
          )}

          {showWaitlist && (
            <EventWaitlist eventId={event.id} isOrganizer={isOrganizer} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
