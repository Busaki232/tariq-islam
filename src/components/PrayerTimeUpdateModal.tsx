import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PrayerTimeUpdateForm from "./PrayerTimeUpdateForm";

interface PrayerTimeUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrayerTimeUpdateModal({ isOpen, onClose }: PrayerTimeUpdateModalProps) {
  const handleSuccess = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Prayer Time Updates</DialogTitle>
          <DialogDescription>
            Help keep our community informed with accurate prayer times. 
            Please provide the correct prayer times for your local mosque.
          </DialogDescription>
        </DialogHeader>
        <PrayerTimeUpdateForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}