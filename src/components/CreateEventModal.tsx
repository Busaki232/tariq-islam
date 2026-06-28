import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateEventForm } from "@/components/CreateEventForm";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
}

export const CreateEventModal = ({ open, onOpenChange, onEventCreated }: CreateEventModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Community Event</DialogTitle>
          <DialogDescription>
            Share an event with the global Muslim community.
          </DialogDescription>
        </DialogHeader>
        <CreateEventForm onEventCreated={onEventCreated} />
      </DialogContent>
    </Dialog>
  );
};