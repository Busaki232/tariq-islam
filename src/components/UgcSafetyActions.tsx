import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type Props = {
  reportedUserId: string;
  reportedUsername?: string | null;
  messageId?: string | null;
  onBlocked?: (blockedUserId: string) => void;
};

const REPORT_REASONS = [
  "Harassment or abuse",
  "Spam",
  "Hate or harmful content",
  "Sexual or explicit content",
  "Impersonation",
  "Other",
];

export default function UgcSafetyActions({
  reportedUserId,
  reportedUsername,
  messageId,
  onBlocked,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const label = useMemo(() => {
    if (reportedUsername?.trim()) return `@${reportedUsername.trim()}`;
    return "this user";
  }, [reportedUsername]);

  const submitReport = async () => {
    if (!user?.id || !reportedUserId || submittingReport) return;

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        message_id: messageId || null,
        reason,
        details: details.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: `Your report about ${label} has been sent for review.`,
      });

      setShowReport(false);
      setDetails("");
      setReason(REPORT_REASONS[0]);
    } catch (e: any) {
      toast({
        title: "Could not submit report",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  const blockUser = async () => {
    if (!user?.id || !reportedUserId || blocking) return;

    setBlocking(true);
    try {
      const { error: blockError } = await supabase.from("blocked_users").insert({
        blocker_id: user.id,
        blocked_id: reportedUserId,
      });

      if (blockError && !String(blockError.message || "").toLowerCase().includes("duplicate")) {
        throw blockError;
      }

      const { error: reportError } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        message_id: messageId || null,
        reason: "Blocked abusive user",
        details: "User was blocked from the app safety controls.",
      });

      if (reportError) {
        console.log("[UgcSafetyActions] report on block failed:", reportError);
      }

      onBlocked?.(reportedUserId);

      toast({
        title: "User blocked",
        description: `${label} has been blocked and hidden from your experience.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not block user",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowReport(true)}>
          Report user
        </Button>

        <Button type="button" variant="destructive" size="sm" onClick={blockUser} disabled={blocking}>
          {blocking ? "Blocking..." : "Block user"}
        </Button>
      </div>

      {showReport ? (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Report user</h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Tell us why you are reporting {label}.
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium">Reason</label>
              <select
                className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium">Details</label>
              <textarea
                className="mt-2 min-h-[100px] w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder="Optional details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowReport(false)}>
                Cancel
              </Button>

              <Button type="button" className="flex-1" onClick={submitReport} disabled={submittingReport}>
                {submittingReport ? "Submitting..." : "Submit report"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}