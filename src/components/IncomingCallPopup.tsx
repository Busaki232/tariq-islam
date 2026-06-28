import { useIncomingCall } from "@/hooks/useIncomingCall";
import { useNavigate } from "react-router-dom";

export default function IncomingCallPopup() {
  const { invite, callerName, accept, decline } = useIncomingCall();
  const navigate = useNavigate();

  if (!invite) return null;

  const onAccept = async () => {
    if (!invite) return;
    
    const result = await accept(invite.id);
    if (!result) return;
    
    const qs = new URLSearchParams({
      roomUrl: result.roomUrl,
      callType: result.callType,
      inviteId: result.inviteId,
      name: callerName ?? "Partner",
    });

    navigate(`/call?${qs.toString()}`, { replace: true });
  };

  const onDecline = async () => {
    await decline(invite.id);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-4 shadow-lg">
        <div className="text-lg font-semibold">
          Incoming {invite.call_type} call
        </div>
        <div className="text-sm opacity-70 mb-4">
          From {callerName ?? "Unknown"}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-lg bg-muted px-4 py-3"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}