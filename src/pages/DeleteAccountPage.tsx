import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function DeleteAccountPage() {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canDelete = useMemo(
    () => confirmText.trim().toLowerCase() === "delete",
    [confirmText]
  );

  const handleDelete = async () => {
    if (!canDelete || submitting) return;

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        throw new Error("Please sign in before requesting account deletion.");
      }

      const { error } = await supabase.functions.invoke("delete-account", {
        body: {
          userId: user.id,
          email: user.email ?? null,
        },
      });

      if (error) throw error;

      await supabase.auth.signOut({ scope: "local" });
      setDone(true);
    } catch (err: any) {
      alert(
        err?.message ||
          "Unable to complete account deletion right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", lineHeight: 1.6 }}>
        <h1>Account Deletion Requested</h1>
        <p>
          Your account deletion request has been submitted successfully.
        </p>
        <p>
          You have been signed out. If your deletion process completes immediately on the
          server, your account and associated data will be removed according to your app’s
          retention policy.
        </p>
        <p style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
          Last updated: March 2026
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", lineHeight: 1.6 }}>
      <h1>Delete Account and Data</h1>

      <p>
        You can use this page to permanently request deletion of your account and associated
        data. This action cannot be undone.
      </p>

      <h2>Before you continue</h2>
      <ul>
        <li>You must be signed in to the account you want to delete.</li>
        <li>This action is permanent.</li>
        <li>Some limited information may be retained where required for legal, security, or fraud-prevention purposes.</li>
      </ul>

      <h2>What we delete</h2>
      <ul>
        <li>Your account profile information, including email, name or username, and avatar.</li>
        <li>App data tied to your account where applicable.</li>
      </ul>

      <h2>Confirm deletion</h2>
      <p>
        Type <strong>delete</strong> below to confirm that you want to permanently delete your account.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type "delete" to continue'
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            fontSize: 16,
          }}
        />

        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete || submitting}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            fontSize: 16,
            fontWeight: 600,
            cursor: !canDelete || submitting ? "not-allowed" : "pointer",
            opacity: !canDelete || submitting ? 0.6 : 1,
            background: "#b91c1c",
            color: "#ffffff",
          }}
        >
          {submitting ? "Deleting account..." : "Delete my account"}
        </button>
      </div>

      <h2 style={{ marginTop: 28 }}>Timeframe</h2>
      <p>
        Deletion timing depends on how your backend is configured. If deletion is immediate,
        your account will be removed right away. If your backend queues deletion, it will be
        processed according to your retention policy.
      </p>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
        Last updated: March 2026
      </p>
    </main>
  );
}