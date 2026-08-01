import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ResetPassword = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error("Unable to check password recovery session:", error);
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      toast.success("Your password has been updated.");

      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Unable to update password:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update your password."
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md border-0 bg-white/95 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>

          <CardTitle className="text-2xl">
            Create a new password
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Enter a secure new password for your Tariq Islam account.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {checkingSession ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verifying password reset link...
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired.
              </p>

              <Button
                type="button"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Return to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  New password
                </Label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter a new password"
                    className="pl-9"
                    disabled={updating}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">
                  Confirm new password
                </Label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm the new password"
                    className="pl-9"
                    disabled={updating}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleUpdatePassword();
                      }
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Use at least 8 characters.
              </p>

              <Button
                type="button"
                className="w-full bg-gradient-primary hover:opacity-90"
                onClick={() => void handleUpdatePassword()}
                disabled={
                  updating ||
                  password.length < 8 ||
                  confirmPassword.length < 8
                }
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPassword;
