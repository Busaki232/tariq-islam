import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContactRequestForm } from './ContactRequestForm';
import { BusinessMessaging } from './BusinessMessaging';

interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  advertisementId: string;
  businessName: string;
}

export const ContactRequestModal = ({ 
  isOpen, 
  onClose, 
  advertisementId, 
  businessName 
}: ContactRequestModalProps) => {
  const [showMessaging, setShowMessaging] = useState(false);
  const [contactRequestId, setContactRequestId] = useState<string | null>(null);

  const handleMessagingRequested = (requestId: string) => {
    setContactRequestId(requestId);
    setShowMessaging(true);
  };

  const handleClose = () => {
    setShowMessaging(false);
    setContactRequestId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={showMessaging ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>
            {showMessaging ? 'Secure Business Messaging' : 'Contact Business'}
          </DialogTitle>
        </DialogHeader>
        
        {showMessaging && contactRequestId ? (
          <BusinessMessaging 
            contactRequestId={contactRequestId} 
            onClose={() => setShowMessaging(false)}
          />
        ) : (
          <ContactRequestForm
            advertisementId={advertisementId}
            businessName={businessName}
            onSuccess={handleClose}
            onCancel={handleClose}
            onMessagingRequested={handleMessagingRequested}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};