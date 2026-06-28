import { useActiveCall } from "@/hooks/useActiveCall";
import CallingScreen from "@/components/CallingScreen";
import { VideoCallScreen } from "@/components/VideoCallScreen";

export default function CallOverlay() {
  const { activeCall, endCall } = useActiveCall();

  if (!activeCall) return null;

  const {
    callState,
    callType,
    otherUserName,
    roomUrl,
  } = activeCall;

  // OUTGOING CALL UI
  if (callState === "calling" || callState === "waiting") {
    return (
      <CallingScreen
        open={true}
        otherUserName={otherUserName || "User"}
        callType={callType}
        onCancel={endCall}
      />
    );
  }

  // CONNECTED CALL UI (video)
  if (callState === "connected" && roomUrl) {
    return <VideoCallScreen />;
  }

  return null;
}