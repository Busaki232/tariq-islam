import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  HeartHandshake,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import HajjDuaLibrary from "@/components/tariq-ai/HajjDuaLibrary";
import { useAuth } from "@/hooks/useAuth";
import {
  askTariqAI,
  type TariqAIMessage,
} from "@/services/tariqAI";

type DisplayMessage = TariqAIMessage & {
  id: string;
  category?: string;
};

type TariqAIMode = "chat" | "hajj";

type HajjChecklistItem = {
  id: string;
  title: string;
  description: string;
  group: "preparation" | "ritual";
};

type HajjDay = {
  id: string;
  date: string;
  title: string;
  location: string;
  steps: string[];
  caution?: string;
};

const HAJJ_PROGRESS_KEY = "tariq_ai_hajj_progress_v1";

const suggestions = [
  "Explain the main lesson of Surah Al-Fatihah.",
  "Find authentic hadith about patience.",
  "What does Islam teach about kindness to neighbors?",
  "Recommend a scholar lecture about prayer.",
];

const hajjSuggestions = [
  "Explain how to enter ihram for Hajj.",
  "What should I do on the Day of Arafah?",
  "Explain the difference between Tawaf and Sa'i.",
  "What should I do if I become separated from my Hajj group?",
];

const hajjChecklist: HajjChecklistItem[] = [
  {
    id: "documents",
    title: "Documents and identification",
    description:
      "Confirm passport, visa, permits, tickets, accommodation information and emergency contacts.",
    group: "preparation",
  },
  {
    id: "medical",
    title: "Health and medication",
    description:
      "Pack prescribed medication, basic first-aid supplies, masks, hydration supplies and medical information.",
    group: "preparation",
  },
  {
    id: "group-contact",
    title: "Group and emergency contacts",
    description:
      "Save your group leader, hotel, transport coordinator and emergency contact information.",
    group: "preparation",
  },
  {
    id: "ihram-items",
    title: "Ihram preparation",
    description:
      "Prepare appropriate ihram clothing, simple footwear and unscented personal-care items.",
    group: "preparation",
  },
  {
    id: "intention",
    title: "Intention and Talbiyah",
    description:
      "Enter the state of ihram at the correct miqat and begin the Talbiyah according to your Hajj type.",
    group: "ritual",
  },
  {
    id: "mina-8",
    title: "Travel to Mina",
    description:
      "Proceed to Mina on the 8th of Dhul-Hijjah and prepare for the following day.",
    group: "ritual",
  },
  {
    id: "arafah",
    title: "Stand at Arafah",
    description:
      "Spend the appointed time at Arafah in worship, remembrance and supplication.",
    group: "ritual",
  },
  {
    id: "muzdalifah",
    title: "Muzdalifah",
    description:
      "Travel to Muzdalifah after Arafah and follow your approved Hajj group plan.",
    group: "ritual",
  },
  {
    id: "jamarat",
    title: "Jamarat",
    description:
      "Perform the required stoning at the designated time while following official crowd-control instructions.",
    group: "ritual",
  },
  {
    id: "sacrifice",
    title: "Sacrifice and hair",
    description:
      "Complete the sacrifice when required for your Hajj type, then shave or shorten the hair.",
    group: "ritual",
  },
  {
    id: "tawaf-ifada",
    title: "Tawaf al-Ifadah",
    description:
      "Complete Tawaf al-Ifadah and the related Sa'i when required.",
    group: "ritual",
  },
  {
    id: "farewell-tawaf",
    title: "Farewell Tawaf",
    description:
      "Complete Tawaf al-Wada before departing Makkah when it applies to you.",
    group: "ritual",
  },
];

const hajjDays: HajjDay[] = [
  {
    id: "day-8",
    date: "8 Dhul-Hijjah",
    title: "Day of Tarwiyah",
    location: "Mina",
    steps: [
      "Enter or remain in ihram according to your Hajj type.",
      "Recite the Talbiyah and travel with your approved group to Mina.",
      "Spend the day and night in Mina in prayer, remembrance and preparation.",
    ],
    caution:
      "Transport arrangements may differ. Follow official instructions and your authorized group leader.",
  },
  {
    id: "day-9",
    date: "9 Dhul-Hijjah",
    title: "Day of Arafah",
    location: "Arafah, then Muzdalifah",
    steps: [
      "Travel from Mina to Arafah.",
      "Remain within the boundaries of Arafah during the appointed time.",
      "Use the day for sincere dua, repentance and remembrance.",
      "After sunset, travel to Muzdalifah without performing Maghrib in Arafah.",
      "Follow your group’s approved prayer and overnight arrangements.",
    ],
    caution:
      "Standing at Arafah is a central Hajj rite. Questions about missing it require immediate guidance from a qualified scholar and Hajj authority.",
  },
  {
    id: "day-10",
    date: "10 Dhul-Hijjah",
    title: "Day of Sacrifice",
    location: "Muzdalifah, Mina and Makkah",
    steps: [
      "Proceed from Muzdalifah toward Mina according to your group schedule.",
      "Stone Jamarat al-Aqabah at the permitted time.",
      "Complete the sacrifice when required.",
      "Shave or shorten the hair.",
      "Perform Tawaf al-Ifadah and Sa'i when required.",
    ],
    caution:
      "The order may be adjusted in some circumstances. Ask a qualified scholar about personal exceptions or missed rites.",
  },
  {
    id: "day-11",
    date: "11 Dhul-Hijjah",
    title: "First Day of Tashriq",
    location: "Mina",
    steps: [
      "Remain in Mina.",
      "Stone the three Jamarat at the permitted time.",
      "Continue prayer, remembrance and rest.",
    ],
  },
  {
    id: "day-12",
    date: "12 Dhul-Hijjah",
    title: "Second Day of Tashriq",
    location: "Mina",
    steps: [
      "Stone the three Jamarat at the permitted time.",
      "Pilgrims leaving early should follow the applicable timing and official movement instructions.",
      "Those remaining continue to Mina for the next day.",
    ],
    caution:
      "Do not make timing decisions solely from AI guidance. Confirm with your group and a qualified scholar.",
  },
  {
    id: "day-13",
    date: "13 Dhul-Hijjah",
    title: "Final Day of Tashriq",
    location: "Mina and Makkah",
    steps: [
      "Pilgrims who remained perform the final stoning of the three Jamarat.",
      "Return to Makkah according to official transport arrangements.",
      "Complete the Farewell Tawaf before departure when applicable.",
    ],
  },
];

const TariqAI = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("common");

  const [mode, setMode] = useState<TariqAIMode>("chat");

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
  const [completedHajjItems, setCompletedHajjItems] = useState<string[]>([]);
  const [openHajjDay, setOpenHajjDay] = useState<string>("day-8");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HAJJ_PROGRESS_KEY);

      if (!stored) return;

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setCompletedHajjItems(
          parsed.filter((item) => typeof item === "string")
        );
      }
    } catch (error) {
      console.error("Unable to load Hajj progress:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        HAJJ_PROGRESS_KEY,
        JSON.stringify(completedHajjItems)
      );
    } catch (error) {
      console.error("Unable to save Hajj progress:", error);
    }
  }, [completedHajjItems]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, submitting]);

  const preparationItems = useMemo(
    () =>
      hajjChecklist.filter(
        (item) => item.group === "preparation"
      ),
    []
  );

  const ritualItems = useMemo(
    () =>
      hajjChecklist.filter((item) => item.group === "ritual"),
    []
  );

  const completedCount = completedHajjItems.length;
  const hajjProgress = Math.round(
    (completedCount / hajjChecklist.length) * 100
  );

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
      const prompt =
        mode === "hajj"
          ? `The user is using Tariq AI Hajj Assistant. Provide careful, practical Hajj guidance. Clearly distinguish general educational guidance from personal religious rulings. Refer questions about missed rites, penalties, menstruation, illness, substitutions, validity, or personal exceptions to a qualified scholar or authorized Hajj guide.\n\nUser question: ${nextQuestion}`
          : nextQuestion;

      const result = await askTariqAI(
        prompt,
        previousMessages
      );

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          category:
            mode === "hajj"
              ? "hajj"
              : result.category,
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
          mode === "hajj"
            ? "Assalamu alaikum. I am Tariq AI Hajj Assistant. I can help with preparation, the day-by-day journey, ritual explanations and safety reminders."
            : "Assalamu alaikum. I am Tariq AI. Ask me about the Quran, Hadith, Islamic learning, translations, or content available in Tariq Islam.",
        category: "welcome",
      },
    ]);

    setErrorMessage("");
    setQuestion("");
  };

  const changeMode = (nextMode: TariqAIMode) => {
    setMode(nextMode);
    setErrorMessage("");
    setQuestion("");

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          nextMode === "hajj"
            ? "Assalamu alaikum. I am Tariq AI Hajj Assistant. I can help with preparation, the day-by-day journey, ritual explanations and safety reminders."
            : "Assalamu alaikum. I am Tariq AI. Ask me about the Quran, Hadith, Islamic learning, translations, or content available in Tariq Islam.",
        category: "welcome",
      },
    ]);
  };

  const toggleHajjItem = (id: string) => {
    setCompletedHajjItems((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const resetHajjProgress = () => {
    const confirmed = window.confirm(
      "Reset all Hajj checklist progress?"
    );

    if (!confirmed) return;

    setCompletedHajjItems([]);
  };

  const renderChecklistGroup = (
    title: string,
    items: HajjChecklistItem[]
  ) => (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        {title}
      </h3>

      <div className="space-y-2">
        {items.map((item) => {
          const completed = completedHajjItems.includes(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleHajjItem(item.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                completed
                  ? "border-primary/30 bg-primary/5"
                  : "bg-background hover:bg-muted/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  completed
                    ? "bg-primary text-primary-foreground"
                    : "border text-muted-foreground"
                }`}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>

              <div>
                <p
                  className={`text-sm font-medium ${
                    completed
                      ? "text-muted-foreground line-through"
                      : ""
                  }`}
                >
                  {item.title}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

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
              {mode === "hajj" ? (
                <MapPin className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">
                {mode === "hajj"
                  ? "Hajj Assistant"
                  : "Tariq AI"}
              </h1>

              <p className="truncate text-xs text-muted-foreground">
                {mode === "hajj"
                  ? "Preparation, rituals, guidance and safety"
                  : "Quran, Hadith and Islamic learning assistant"}
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
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border bg-muted/40 p-1.5">
          <button
            type="button"
            onClick={() => changeMode("chat")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              mode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Tariq AI
          </button>

          <button
            type="button"
            onClick={() => changeMode("hajj")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              mode === "hajj"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Hajj Assistant
          </button>
        </div>

        {mode === "chat" ? (
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
        ) : (
          <>
            <section className="mb-4 rounded-2xl bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0 text-primary" />

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">
                    Your Hajj journey
                  </h2>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Follow your preparation and ritual checklist, review
                    the day-by-day guide and ask Tariq AI general Hajj
                    questions.
                  </p>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium">
                        {completedCount} of {hajjChecklist.length} completed
                      </span>
                      <span className="text-muted-foreground">
                        {hajjProgress}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${hajjProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />

                <div>
                  <h3 className="text-sm font-semibold">
                    Religious guidance notice
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Tariq AI provides general educational guidance. Questions
                    about missed rites, penalties, menstruation, illness,
                    substitutions, validity of Hajj or personal exceptions
                    must be confirmed with a qualified scholar or authorized
                    Hajj guide.
                  </p>
                </div>
              </div>
            </section>

            <div className="mb-5 grid gap-4">
              {renderChecklistGroup(
                "Before Hajj",
                preparationItems
              )}

              {renderChecklistGroup(
                "Ritual progress",
                ritualItems
              )}

              <Button
                type="button"
                variant="outline"
                onClick={resetHajjProgress}
                disabled={completedCount === 0}
                className="w-full"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset checklist progress
              </Button>
            </div>

            <section className="mb-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-5 w-5 text-primary" />
                Day-by-day Hajj guide
              </h2>

              <div className="space-y-2">
                {hajjDays.map((day) => {
                  const isOpen = openHajjDay === day.id;

                  return (
                    <article
                      key={day.id}
                      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenHajjDay(
                            isOpen ? "" : day.id
                          )
                        }
                        className="flex w-full items-center gap-3 p-4 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CalendarDays className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {day.date}
                          </p>
                          <h3 className="truncate font-semibold">
                            {day.title}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {day.location}
                          </p>
                        </div>

                        {isOpen ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t px-4 pb-4 pt-3">
                          <ol className="space-y-3">
                            {day.steps.map((step, index) => (
                              <li
                                key={`${day.id}-${index}`}
                                className="flex items-start gap-3 text-sm leading-relaxed"
                              >
                                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                  {index + 1}
                                </div>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>

                          {day.caution && (
                            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {day.caution}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

                        <HajjDuaLibrary />

<section className="mb-5 rounded-2xl border bg-card p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Safety and emergency reminders
              </h2>

              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Keep your identification, hotel information and group
                  contact details with you.
                </p>
                <p>
                  Follow official crowd-control routes and never move against
                  the direction of the crowd.
                </p>
                <p>
                  Hydrate regularly, rest when needed and seek medical help
                  for heat illness, chest pain, breathing difficulty,
                  confusion or fainting.
                </p>
                <p>
                  When separated from your group, move to a safe official
                  assistance point and contact your group leader rather than
                  wandering through crowds.
                </p>
              </div>
            </section>
          </>
        )}

        {messages.length === 1 && (
          <section className="mb-5">
            <h2 className="mb-3 text-sm font-semibold">
              {mode === "hajj"
                ? "Ask the Hajj Assistant"
                : "Try asking"}
            </h2>

            <div className="grid gap-2 sm:grid-cols-2">
              {(mode === "hajj"
                ? hajjSuggestions
                : suggestions
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    void submitQuestion(undefined, suggestion)
                  }
                  className="rounded-xl border bg-card p-3 text-left text-sm leading-relaxed transition hover:bg-muted"
                >
                  {mode === "hajj" ? (
                    <MapPin className="mb-2 h-4 w-4 text-primary" />
                  ) : (
                    <BookOpen className="mb-2 h-4 w-4 text-primary" />
                  )}
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
                  ) : mode === "hajj" ? (
                    <MapPin className="h-4 w-4" />
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
                {mode === "hajj" ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
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

        {mode === "hajj" && hajjProgress === 100 && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">
                Checklist completed
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review your official Hajj group instructions and confirm
                personal religious questions with a qualified scholar.
              </p>
            </div>
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
                ? mode === "hajj"
                  ? "Ask about your Hajj journey..."
                  : "Ask Tariq AI..."
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
