import { supabase } from "@/integrations/supabase/client";

export type TariqAIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TariqAITransformAction =
  | "translate"
  | "summarize"
  | "translate_and_summarize";

export type TariqAITransformLanguage =
  | "en"
  | "ar"
  | "fr"
  | "ha"
  | "yo";

type TariqAIResponse = {
  answer?: string;
  category?: string;
  error?: string;
};

export async function askTariqAI(
  message: string,
  history: TariqAIMessage[] = []
): Promise<{
  answer: string;
  category: string;
}> {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error("Please enter a question.");
  }

  const safeHistory = history
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 4000),
    }))
    .filter((item) => item.content.length > 0);

  const { data, error } = await supabase.functions.invoke<TariqAIResponse>(
    "tariq-ai",
    {
      body: {
        message: trimmedMessage.slice(0, 6000),
        history: safeHistory,
      },
    }
  );

  if (error) {
    throw new Error(error.message || "Tariq AI is currently unavailable.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.answer) {
    throw new Error("Tariq AI returned an empty response.");
  }

  return {
    answer: data.answer,
    category: data.category || "general",
  };
}

export async function transformIslamicText(
  text: string,
  action: TariqAITransformAction,
  targetLanguage: TariqAITransformLanguage
): Promise<{
  answer: string;
  category: string;
}> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Please enter text to process.");
  }

  if (trimmedText.length > 12000) {
    throw new Error(
      "The text is too long. Please keep it under 12,000 characters."
    );
  }

  const { data, error } =
    await supabase.functions.invoke<TariqAIResponse>(
      "tariq-transform",
      {
        body: {
          text: trimmedText,
          action,
          targetLanguage,
        },
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "Translation and summary tools are currently unavailable."
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.answer) {
    throw new Error("Tariq AI returned an empty result.");
  }

  return {
    answer: data.answer,
    category: data.category || "translation",
  };
}

