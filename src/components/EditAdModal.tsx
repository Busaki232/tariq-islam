import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdSubmissionForm } from './AdSubmissionForm';

interface EditAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: {
    id: string;
    title: string;
    description: string;
    category_id: string;
    location: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    website: string | null;
    image_url: string | null;
  };
  onSuccess: () => void;
}

export const EditAdModal = ({ isOpen, onClose, ad, onSuccess }: EditAdModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Advertisement</DialogTitle>
        </DialogHeader>
        <AdSubmissionForm
          mode="edit"
          advertisementId={ad.id}
          initialData={{
            title: ad.title,
            description: ad.description,
            category_id: ad.category_id,
            location: ad.location || '',
            contact_email: ad.contact_email || '',
            contact_phone: ad.contact_phone || '',
            website: ad.website || '',
          }}
          existingImageUrl={ad.image_url}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
};
