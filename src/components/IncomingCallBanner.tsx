import { Phone, Video, X } from 'lucide-react';
import { Button } from './ui/button';
import { useIncomingCall } from '@/hooks/useIncomingCall';

export const IncomingCallBanner = () => {
  const { invite, callerName, accept, decline } = useIncomingCall();

  if (!invite) return null;

  const Icon = invite.call_type === 'video' ? Video : Phone;

  const handleAnswer = async () => {
    await accept(invite.id);
  };

  const handleDecline = async () => {
    await decline(invite.id);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-slide-down">
      <div className="max-w-2xl mx-auto bg-gradient-to-r from-primary to-primary/90 rounded-xl shadow-2xl border border-primary/20">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:brightness-110 transition-all"
          onClick={handleAnswer}
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-white font-semibold text-lg">
                Incoming call from {callerName ?? "Unknown"}
              </div>
              <div className="text-white/80 text-sm">
                Tap to answer
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDecline();
            }}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
            title="Decline call"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
