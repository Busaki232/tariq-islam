import { ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const TERMS_ACCEPTED_KEY = "ugc_terms_accepted_v1";

type Props = {
  children: ReactNode;
};

export default function UgcTermsGate({ children }: Props) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(TERMS_ACCEPTED_KEY) === "true");
    } catch {
      setAccepted(false);
    }
  }, []);

  const acceptTerms = () => {
    try {
      localStorage.setItem(TERMS_ACCEPTED_KEY, "true");
    } catch {
      // ignore
    }
    setAccepted(true);
  };

  if (accepted === null) {
    return null;
  }

  if (accepted) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-3">Terms of Use</h1>

        <p className="text-sm text-muted-foreground mb-4">
          Before accessing community content, you must agree to use Tariq Islam respectfully and
          responsibly.
        </p>

        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
          <li>No abusive, threatening, hateful, or sexually explicit content.</li>
          <li>No harassment, scams, impersonation, or spam.</li>
          <li>Respect other users and follow community guidelines.</li>
          <li>Objectionable users or content may be reported and blocked.</li>
        </ul>

        <div className="mt-6 flex gap-3">
          <Button className="flex-1" onClick={acceptTerms} type="button">
            I Agree
          </Button>
        </div>
      </div>
    </div>
  );
}