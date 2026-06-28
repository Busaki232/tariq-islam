// src/pages/Connect.tsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserConnections } from "@/hooks/useUserConnections";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

type ConnectState =
  | "loading"
  | "success"
  | "error"
  | "not_found"
  | "not_logged_in";

type ProfileLookup = {
  user_id: string;
  full_name: string | null;
  username: string | null;
};

export default function Connect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { sendConnectionRequest } = useUserConnections();

  const [state, setState] = useState<ConnectState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const rawIdentifier = params.get("u") || "";
      const identifier = rawIdentifier.trim();

      if (!identifier) {
        if (!cancelled) {
          setState("error");
          setMessage("Invalid invite link.");
        }
        return;
      }

      if (!user?.id) {
        if (!cancelled) {
          setState("not_logged_in");
          setMessage("Please log in first to connect.");
        }
        return;
      }

      try {
        let profile: ProfileLookup | null = null;

        const { data: byUsername, error: usernameError } = await supabase
          .from("profiles")
          .select("user_id, full_name, username")
          .eq("username", identifier)
          .maybeSingle();

        if (usernameError) throw usernameError;
        if (byUsername?.user_id) {
          profile = byUsername as ProfileLookup;
        }

        if (!profile) {
          const { data: byId, error: idError } = await supabase
            .from("profiles")
            .select("user_id, full_name, username")
            .eq("user_id", identifier)
            .maybeSingle();

          if (idError) throw idError;
          if (byId?.user_id) {
            profile = byId as ProfileLookup;
          }
        }

        if (!profile?.user_id) {
          if (!cancelled) {
            setState("not_found");
            setMessage("User not found.");
          }
          return;
        }

        if (profile.user_id === user.id) {
          if (!cancelled) {
            setState("error");
            setMessage("You cannot connect with yourself.");
          }
          return;
        }

        await sendConnectionRequest(profile.user_id);

        if (!cancelled) {
          setState("success");
          setMessage(
            `Connection request sent to ${
              profile.full_name || profile.username || "user"
            }.`
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          setState("error");
          setMessage(e?.message || "Something went wrong.");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [params, user?.id, sendConnectionRequest]);

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin" />
              <div className="text-sm text-muted-foreground">Connecting...</div>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
              <div className="font-medium">{message}</div>
              <Button onClick={() => navigate("/messages")}>Go to Messages</Button>
            </>
          )}

          {state === "not_logged_in" && (
            <>
              <XCircle className="mx-auto h-10 w-10 text-yellow-600" />
              <div>{message || "Please log in first to connect."}</div>
              <Button onClick={() => navigate("/auth")}>Go to Login</Button>
            </>
          )}

          {state === "not_found" && (
            <>
              <XCircle className="mx-auto h-10 w-10 text-red-600" />
              <div>{message || "User not found."}</div>
              <Button variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="mx-auto h-10 w-10 text-red-600" />
              <div>{message}</div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Go Home
                </Button>
                <Button onClick={() => navigate("/messages")}>Go to Messages</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}