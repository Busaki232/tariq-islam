const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (
  body: unknown,
  status = 200
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const supportedLanguages: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
  ha: "Hausa",
  yo: "Yoruba",
};

const supportedActions: Record<string, string> = {
  translate: "Translate",
  summarize: "Summarize",
  translate_and_summarize:
    "Translate and summarize",
};

const extractResponseText = (
  result: any
): string => {
  if (
    typeof result?.output_text === "string" &&
    result.output_text.trim()
  ) {
    return result.output_text.trim();
  }

  if (!Array.isArray(result?.output)) {
    return "";
  }

  return result.output
    .flatMap((item: any) =>
      Array.isArray(item?.content)
        ? item.content
        : []
    )
    .filter(
      (content: any) =>
        content?.type === "output_text" &&
        typeof content?.text === "string"
    )
    .map((content: any) =>
      content.text.trim()
    )
    .filter(Boolean)
    .join("\n\n");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const authorization =
      request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        {
          error:
            "Please sign in to use this tool.",
        },
        401
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");
    const openAiKey =
      Deno.env.get("OPENAI_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !openAiKey
    ) {
      return jsonResponse(
        {
          error:
            "Required server configuration is missing.",
        },
        500
      );
    }

    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          Authorization: authorization,
          apikey: supabaseAnonKey,
        },
      }
    );

    if (!userResponse.ok) {
      return jsonResponse(
        {
          error:
            "Please sign in to use this tool.",
        },
        401
      );
    }

    const body = await request.json();

    const sourceText =
      typeof body?.text === "string"
        ? body.text.trim()
        : "";

    const action =
      typeof body?.action === "string"
        ? body.action
        : "";

    const targetLanguage =
      typeof body?.targetLanguage === "string"
        ? body.targetLanguage
        : "";

    if (!sourceText) {
      return jsonResponse(
        { error: "Text is required." },
        400
      );
    }

    if (sourceText.length > 12000) {
      return jsonResponse(
        {
          error:
            "The text is too long. Please keep it under 12,000 characters.",
        },
        400
      );
    }

    if (!supportedActions[action]) {
      return jsonResponse(
        {
          error:
            "Select Translate, Summarize, or Translate and Summarize.",
        },
        400
      );
    }

    if (!supportedLanguages[targetLanguage]) {
      return jsonResponse(
        {
          error:
            "Select a supported target language.",
        },
        400
      );
    }

    const actionName =
      supportedActions[action];

    const languageName =
      supportedLanguages[targetLanguage];

    const model =
      Deno.env.get("TARIQ_AI_MODEL") ||
      "gpt-5-mini";

    const instructions = `
You are Tariq AI's Islamic educational translation and summarization assistant.

Requested action: ${actionName}
Target language: ${languageName}

Rules:
- Perform only the requested action.
- Write the final result in ${languageName}.
- Preserve Quran references exactly, including chapter numbers, verse numbers, verse ranges, and Surah names.
- Preserve Hadith collection names, book names, reference numbers, narrator names, and authenticity labels exactly when supplied.
- Never invent Quran verses, Hadith wording, references, narrators, collections, or authenticity grades.
- If Arabic Quran text appears in the source, preserve that Arabic wording exactly as supplied.
- Preserve important Islamic terms carefully, including Allah, Quran, Hadith, Salah, Zakat, Hajj, Umrah, Sunnah, Tawaf, Ihram, and Surah names.
- Do not alter the intended religious meaning.
- Do not add a fatwa, personal ruling, or unsupported religious claim.
- Do not add facts that are absent from the source.
- For summaries, retain the main lesson, important cautions, names, dates, and cited references.
- For Translate and Summarize, use the headings "Translation" and "Summary", translated naturally into the target language.
- Do not provide hidden reasoning or internal analysis.
`.trim();

    const input = `
Process this Islamic educational text:

${sourceText}
`.trim();

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${openAiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model,
          instructions,
          input,
          reasoning: {
            effort: "low",
          },
          text: {
            verbosity:
              action === "summarize"
                ? "low"
                : "medium",
          },
          max_output_tokens: 2400,
        }),
      }
    );

    const openAiResult =
      await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error(
        "Tariq transform OpenAI error:",
        openAiResult
      );

      return jsonResponse(
        {
          error:
            openAiResult?.error?.message ||
            "Unable to process the text.",
        },
        openAiResponse.status
      );
    }

    const answer =
      extractResponseText(openAiResult);

    if (!answer) {
      console.error(
        "Tariq transform returned no text:",
        {
          status: openAiResult?.status,
          incomplete_details:
            openAiResult?.incomplete_details,
          output: openAiResult?.output,
        }
      );

      return jsonResponse(
        {
          error:
            openAiResult?.incomplete_details
              ?.reason === "max_output_tokens"
              ? "The result reached its response limit. Please use shorter text."
              : "Tariq AI returned an empty result.",
        },
        502
      );
    }

    return jsonResponse({
      answer,
      category:
        action === "summarize"
          ? "summary"
          : "translation",
      action,
      targetLanguage,
    });
  } catch (error) {
    console.error(
      "Tariq transform function error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected transformation error.",
      },
      500
    );
  }
});
