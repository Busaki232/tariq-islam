import { useUserConnections } from "@/hooks/useUserConnections";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function PendingRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    pendingReceived = [],
    pendingSent = [],
    acceptRequest,
    declineRequest,
    cancelSentRequest,
  } = useUserConnections();

  const handleAccept = async (req: any) => {
    await acceptRequest(req.id);

    await supabase.from("notifications").insert({
      user_id: req.requester_id,
      actor_id: user?.id,
      type: "follow_accepted",
      title: "Your follow request was accepted",
      body: "You can now message each other.",
    });
  };

  return (
    <div className="p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <h1 className="text-xl font-semibold mb-6">Pending Requests</h1>

      <div className="mb-8">
        <h2 className="font-semibold mb-3">Incoming</h2>

        {pendingReceived.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No incoming requests.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingReceived.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {req.other.full_name || "Unnamed User"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {req.other.location || "Location not set"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleAccept(req)}
                    className="rounded-lg bg-green-600 text-white px-3 py-1 text-sm"
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => void declineRequest(req.id)}
                    className="rounded-lg border px-3 py-1 text-sm"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Sent</h2>

        {pendingSent.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No outgoing requests.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSent.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {req.other.full_name || "Unnamed User"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pending
                  </div>
                </div>

            <button
              onClick={async () => {
                await acceptRequest(req.id);

                await supabase.from("notifications").insert({
                  user_id: req.other.user_id,
                  actor_id: user?.id,
                  type: "follow_accepted",
                  title: "Your follow request was accepted",
                  body: "You can now message each other.",
                });
              }}
                  className="rounded-lg border px-3 py-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}