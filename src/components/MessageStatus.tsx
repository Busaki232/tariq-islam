import { Check, CheckCheck } from 'lucide-react';

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export const MessageStatus = ({ status, className = '' }: MessageStatusProps) => {
  if (status === 'sending') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </span>
    );
  }

  if (status === 'sent') {
    return <Check className={`w-4 h-4 ${className}`} />;
  }

  if (status === 'delivered') {
    return <CheckCheck className={`w-4 h-4 ${className}`} />;
  }

  // Read - blue double checks
  return <CheckCheck className={`w-4 h-4 text-[#34B7F1] ${className}`} />;
};
