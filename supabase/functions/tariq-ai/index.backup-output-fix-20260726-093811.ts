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

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const validHistory = (
  value: unknown
): ConversationMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-10)
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.role === "user" ||
          item.role === "assistant") &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 4000),
    }))
    .filter((item) => item.content.length > 0);
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
        { error: "Please sign in to use Tariq AI." },
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
        { error: "Please sign in to use Tariq AI." },
        401
      );
    }

    const body = await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return jsonResponse(
        { error: "A question is required." },
        400
      );
    }

    if (message.length > 6000) {
      return jsonResponse(
        {
          error:
            "Your question is too long. Please shorten it.",
        },
        400
      );
    }

    const history = validHistory(body?.history);

    const conversation = history
      .map(
        (item) =>
          `${item.role === "user" ? "User" : "Tariq AI"}: ${
            item.content
          }`
      )
      .join("\n\n");

    const developerInstruction = `
You are Tariq AI, the Islamic learning assistant inside the Tariq Islam application.

Your responsibilities:
- Explain Quranic themes carefully and respectfully.
- Help users locate relevant Quran and authentic Hadith references.
- Explain general Islamic concepts in clear language.
- Help translate Islamic educational content.
- Recommend that users consult qualified scholars for personal fatwas, legal rulings, marriage disputes, divorce, inheritance, medical decisions, financial rulings, or other high-stakes matters.
- Clearly distinguish established source material from interpretation.
- Never invent Quran verses, verse numbers, Hadith wording, narrators, collections, or authenticity grades.
- If you cannot verify an exact quotation or reference, say so plainly.
- Avoid sectarian attacks, takfir, extremist advocacy, hatred, violence, or political recruitment.
- Do not claim to be a scholar, imam, mufti, or replacement for qualified religious guidance.
- Be warm, concise, respectful, and suitable for a diverse Muslim audience.
- When relevant, organize the response under short headings.
- Answer in the same language as the user's question when practical.

At the end of the response, include:
Category: Quran, Hadith, Translation, Recommendation, Moderation, or General

Do not include hidden reasoning or internal analysis.
`.trim();

    const prompt = `
${conversation ? `Previous conversation:\n${conversation}\n\n` : ""}
User's current question:
${message}
`.trim();

    const model =
      Deno.env.get("TARIQ_AI_MODEL") ||
      "gpt-5-mini";

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: developerInstruction,
          input: prompt,
          max_output_tokens: 900,
        }),
      }
    );

    const openAiResult =
      await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error(
        "Tariq AI OpenAI error:",
        openAiResult
      );

      return jsonResponse(
        {
          error:
            openAiResult?.error?.message ||
            "Tariq AI is currently unavailable.",
        },
        openAiResponse.status
      );
    }

    const rawAnswer =
      typeof openAiResult?.output_text === "string"
        ? openAiResult.output_text.trim()
        : "";

    if (!rawAnswer) {
      console.error(
        "Tariq AI returned no output_text:",
        openAiResult
      );

      return jsonResponse(
        {
          error:
            "Tariq AI returned an empty response.",
        },
        502
      );
    }

    const categoryMatch = rawAnswer.match(
      /\n?Category:\s*(Quran|Hadith|Translation|Recommendation|Moderation|General)\s*$/i
    );

    const category = categoryMatch
      ? categoryMatch[1].toLowerCase()
      : "general";

    const answer = rawAnswer
      .replace(
        /\n?Category:\s*(Quran|Hadith|Translation|Recommendation|Moderation|General)\s*$/i,
        ""
      )
      .trim();

    return jsonResponse({
      answer,
      category,
    });
  } catch (error) {
    console.error("Tariq AI function error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected Tariq AI error.",
      },
      500
    );
  }
});
