import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  askTariqAI,
  type TariqAIMessage,
} from "@/services/tariqAI";

type DisplayMessage = TariqAIMessage & {
  id: string;
  category?: string;
};

const suggestions = [
  "Explain the main lesson of Surah Al-Fatihah.",
  "Find authentic hadith about patience.",
  "What does Islam teach about kindness to neighbors?",
  "Recommend a scholar lecture about prayer.",
];

const TariqAI = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("common");

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Assalamu alaikum. I am Tariq AI. Ask me about the Quran, Hadith, Islamic learning, translations, or content available in Tariq Islam.",
      category: "welcome",
    },
  ]);

  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, submitting]);

  const submitQuestion = async (
    event?: FormEvent<HTMLFormElement>,
    suggestedQuestion?: string
  ) => {
    event?.preventDefault();

    const nextQuestion = (
      suggestedQuestion ?? question
    ).trim();

    if (!nextQuestion || submitting) {
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: nextQuestion,
    };

    const previousMessages = messages
      .filter((message) => message.id !== "welcome")
      .map(({ role, content }) => ({
        role,
        content,
      }));

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setErrorMessage("");
    setSubmitting(true);

    try {
      const result = await askTariqAI(
        nextQuestion,
        previousMessages
      );

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          category: result.category,
        },
      ]);
    } catch (error: any) {
      console.error("Tariq AI request failed:", error);

      setErrorMessage(
        error?.message ||
          "Tariq AI is currently unavailable. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Assalamu alaikum. I am Tariq AI. Ask me about the Quran, Hadith, Islamic learning, translations, or content available in Tariq Islam.",
        category: "welcome",
      },
    ]);

    setErrorMessage("");
    setQuestion("");
  };

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
                return;
              }

              navigate("/");
            }}
            aria-label={t("callsPage.back", {
              defaultValue: "Back",
            })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">
                Tariq AI
              </h1>

              <p className="truncate text-xs text-muted-foreground">
                Quran, Hadith and Islamic learning assistant
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearConversation}
            aria-label="Clear conversation"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-5">
        <section className="mb-5 rounded-2xl bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-6 w-6 shrink-0 text-primary" />

            <div>
              <h2 className="font-semibold">
                Ask anything about Islam
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Tariq AI can help explain Islamic topics, locate
                Quran and Hadith references, translate text and
                recommend learning content.
              </p>

              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                AI responses may contain mistakes. Important religious
                rulings should be confirmed with a qualified scholar.
              </p>
            </div>
          </div>
        </section>

        {messages.length === 1 && (
          <section className="mb-5">
            <h2 className="mb-3 text-sm font-semibold">
              Try asking
            </h2>

            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    void submitQuestion(undefined, suggestion)
                  }
                  className="rounded-xl border bg-card p-3 text-left text-sm leading-relaxed transition hover:bg-muted"
                >
                  <BookOpen className="mb-2 h-4 w-4 text-primary" />
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        )}

        <section
          className="space-y-4"
          aria-live="polite"
        >
          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  isUser ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isUser
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isUser ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                    isUser
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border bg-card text-card-foreground"
                  }`}
                >
                  {message.content}

                  {!isUser &&
                    message.category &&
                    message.category !== "welcome" && (
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                        {message.category}
                      </div>
                    )}
                </div>
              </div>
            );
          })}

          {submitting && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Tariq AI is thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <form
          onSubmit={(event) => void submitQuestion(event)}
          className="mx-auto flex w-full max-w-3xl items-end gap-2"
        >
          <textarea
            value={question}
            onChange={(event) =>
              setQuestion(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void submitQuestion();
              }
            }}
            placeholder={
              user
                ? "Ask Tariq AI..."
                : "Sign in to ask Tariq AI..."
            }
            disabled={submitting}
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />

          <Button
            type="submit"
            size="icon"
            disabled={
              submitting || question.trim().length === 0
            }
            className="h-11 w-11 shrink-0 rounded-full"
            aria-label="Send question"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default TariqAI;
