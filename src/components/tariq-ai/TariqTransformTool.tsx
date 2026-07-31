import { useState } from "react";
import {
  Check,
  Clipboard,
  Languages,
  Loader2,
  Share2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  transformIslamicText,
  type TariqAITransformAction,
  type TariqAITransformLanguage,
} from "@/services/tariqAI";

type TariqTransformToolProps = {
  isOnline: boolean;
};

const actions: Array<{
  value: TariqAITransformAction;
  label: string;
}> = [
  {
    value: "translate",
    label: "Translate",
  },
  {
    value: "summarize",
    label: "Summarize",
  },
  {
    value: "translate_and_summarize",
    label: "Translate + Summarize",
  },
];

const languages: Array<{
  value: TariqAITransformLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "ha", label: "Hausa" },
  { value: "yo", label: "Yoruba" },
];

const TariqTransformTool = ({
  isOnline,
}: TariqTransformToolProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sourceText, setSourceText] = useState("");
  const [action, setAction] =
    useState<TariqAITransformAction>("translate");
  const [targetLanguage, setTargetLanguage] =
    useState<TariqAITransformLanguage>("en");

  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const sourceLength = sourceText.length;
  const canSubmit =
    isOnline &&
    !processing &&
    sourceText.trim().length > 0 &&
    sourceLength <= 12000;

  const processText = async () => {
    if (!isOnline) {
      setErrorMessage(
        "Translation and summaries require an internet connection."
      );
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    const trimmedText = sourceText.trim();

    if (!trimmedText) {
      setErrorMessage("Please enter text to process.");
      return;
    }

    if (trimmedText.length > 12000) {
      setErrorMessage(
        "The text is too long. Please keep it under 12,000 characters."
      );
      return;
    }

    setProcessing(true);
    setErrorMessage("");
    setResult("");
    setCopied(false);

    try {
      const response = await transformIslamicText(
        trimmedText,
        action,
        targetLanguage
      );

      setResult(response.answer);
    } catch (error: any) {
      console.error(
        "Translate and summarize request failed:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to process the text. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Unable to copy result:", error);
      setErrorMessage("Unable to copy the result.");
    }
  };

  const shareResult = async () => {
    if (!result) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Tariq AI",
          text: result,
        });

        return;
      }

      await navigator.clipboard.writeText(result);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Unable to share result:", error);
        setErrorMessage("Unable to share the result.");
      }
    }
  };

  const clearTool = () => {
    setSourceText("");
    setResult("");
    setErrorMessage("");
    setCopied(false);
  };

  return (
    <div className="space-y-4">
      {!isOnline && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />

            <div>
              <h2 className="text-sm font-semibold">
                Internet connection required
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Reconnect to translate or summarize text.
                Your offline Hajj tools remain available in
                Hajj Assistant.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <Languages className="mt-0.5 h-6 w-6 shrink-0 text-primary" />

          <div>
            <h2 className="font-semibold">
              Translate &amp; Summarize
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Translate Islamic educational content, create
              a clear summary, or do both.
            </p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Quran and Hadith references are preserved, but
              important religious content should still be
              reviewed by a qualified scholar.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">
              Action
            </span>

            <select
              value={action}
              onChange={(event) =>
                setAction(
                  event.target
                    .value as TariqAITransformAction
                )
              }
              disabled={processing}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              {actions.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">
              Output language
            </span>

            <select
              value={targetLanguage}
              onChange={(event) =>
                setTargetLanguage(
                  event.target
                    .value as TariqAITransformLanguage
                )
              }
              disabled={processing}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              {languages.map((language) => (
                <option
                  key={language.value}
                  value={language.value}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Text
            </span>

            <span
              className={`text-xs ${
                sourceLength > 12000
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {sourceLength.toLocaleString()} / 12,000
            </span>
          </div>

          <textarea
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setErrorMessage("");
            }}
            disabled={processing}
            rows={9}
            placeholder="Paste a lecture transcript, reflection, announcement, Islamic article, or other educational text..."
            className="w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void processText()}
            disabled={!canSubmit}
            className="rounded-xl"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Process text
              </>
            )}
          </Button>

          {(sourceText || result) && (
            <Button
              type="button"
              variant="outline"
              onClick={clearTool}
              disabled={processing}
              className="rounded-xl"
            >
              Clear
            </Button>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {result && (
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Result</h2>

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void copyResult()}
                aria-label="Copy result"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Clipboard className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void shareResult()}
                aria-label="Share result"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            dir={
              targetLanguage === "ar"
                ? "rtl"
                : "ltr"
            }
            className="whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-7"
          >
            {result}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            AI-generated translations and summaries may
            contain mistakes. Verify Quran quotations,
            Hadith references and important religious
            guidance before publishing.
          </p>
        </section>
      )}
    </div>
  );
};

export default TariqTransformTool;
