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

type QuranTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type QuranTranslation = {
  id?: number;
  name?: string;
  author_name?: string;
  language_name?: string;
};

type QuranChapter = {
  id?: number;
  name_simple?: string;
  name_complex?: string;
  translated_name?: {
    name?: string;
  };
  verses_count?: number;
};

type QuranVerse = {
  verse_key?: string;
  text_uthmani?: string;
  translations?: Array<{
    id?: number;
    resource_id?: number;
    text?: string;
  }>;
};

let quranTokenCache: QuranTokenCache | null = null;
let quranTranslationIdCache: number | null = null;
let quranChaptersCache: QuranChapter[] | null = null;

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

const stripHtml = (value: unknown): string => {
  if (typeof value !== "string") return "";

  return value
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`-]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getQuranEnvironment = () => {
  const environment =
    Deno.env.get("QF_ENV")?.toLowerCase() ===
    "production"
      ? "production"
      : "prelive";

  if (environment === "production") {
    return {
      authBaseUrl:
        "https://oauth2.quran.foundation",
      apiBaseUrl:
        "https://apis.quran.foundation",
    };
  }

  return {
    authBaseUrl:
      "https://prelive-oauth2.quran.foundation",
    apiBaseUrl:
      "https://apis-prelive.quran.foundation",
  };
};

const getQuranAccessToken = async (
  forceRefresh = false
): Promise<string> => {
  if (
    !forceRefresh &&
    quranTokenCache &&
    Date.now() < quranTokenCache.expiresAt
  ) {
    return quranTokenCache.accessToken;
  }

  const clientId =
    Deno.env.get("QF_CLIENT_ID");
  const clientSecret =
    Deno.env.get("QF_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Quran Foundation credentials are missing."
    );
  }

  const { authBaseUrl } =
    getQuranEnvironment();

  const basicAuthorization = btoa(
    `${clientId}:${clientSecret}`
  );

  const tokenResponse = await fetch(
    `${authBaseUrl}/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${basicAuthorization}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials&scope=content",
    }
  );

  const tokenResult =
    await tokenResponse.json();

  if (
    !tokenResponse.ok ||
    typeof tokenResult?.access_token !== "string"
  ) {
    console.error(
      "Quran Foundation token error:",
      tokenResult
    );

    throw new Error(
      tokenResult?.error_description ||
        tokenResult?.error ||
        "Unable to authenticate with Quran Foundation."
    );
  }

  const expiresIn =
    typeof tokenResult?.expires_in === "number"
      ? tokenResult.expires_in
      : 3600;

  quranTokenCache = {
    accessToken: tokenResult.access_token,
    expiresAt:
      Date.now() +
      Math.max(expiresIn - 60, 60) * 1000,
  };

  return tokenResult.access_token;
};

const quranApiFetch = async (
  pathname: string,
  retryOnUnauthorized = true
): Promise<any> => {
  const clientId =
    Deno.env.get("QF_CLIENT_ID");

  if (!clientId) {
    throw new Error(
      "Quran Foundation client ID is missing."
    );
  }

  const { apiBaseUrl } =
    getQuranEnvironment();

  const accessToken =
    await getQuranAccessToken();

  const response = await fetch(
    `${apiBaseUrl}/content/api/v4${pathname}`,
    {
      headers: {
        "x-auth-token": accessToken,
        "x-client-id": clientId,
        Accept: "application/json",
      },
    }
  );

  if (
    response.status === 401 &&
    retryOnUnauthorized
  ) {
    await getQuranAccessToken(true);

    return quranApiFetch(pathname, false);
  }

  const result = await response.json();

  if (!response.ok) {
    console.error(
      "Quran Foundation API error:",
      {
        pathname,
        status: response.status,
        result,
      }
    );

    throw new Error(
      result?.message ||
        result?.error ||
        `Quran lookup failed with status ${response.status}.`
    );
  }

  return result;
};

const getEnglishTranslationId =
  async (): Promise<number> => {
    const configuredId = Number(
      Deno.env.get("QF_TRANSLATION_ID")
    );

    if (
      Number.isInteger(configuredId) &&
      configuredId > 0
    ) {
      return configuredId;
    }

    if (quranTranslationIdCache) {
      return quranTranslationIdCache;
    }

    const result = await quranApiFetch(
      "/resources/translations?language=en"
    );

    const translations: QuranTranslation[] =
      Array.isArray(result?.translations)
        ? result.translations
        : [];

    const preferred =
      translations.find((translation) => {
        const description =
          `${translation.name || ""} ${
            translation.author_name || ""
          }`.toLowerCase();

        return description.includes(
          "sahih international"
        );
      }) ||
      translations.find((translation) => {
        const language =
          translation.language_name
            ?.toLowerCase();

        return language === "english";
      });

    if (
      !preferred ||
      !Number.isInteger(preferred.id)
    ) {
      throw new Error(
        "No English Quran translation resource was found."
      );
    }

    quranTranslationIdCache =
      preferred.id as number;

    return quranTranslationIdCache;
  };

const getQuranChapters =
  async (): Promise<QuranChapter[]> => {
    if (quranChaptersCache) {
      return quranChaptersCache;
    }

    const result = await quranApiFetch(
      "/chapters?language=en"
    );

    quranChaptersCache =
      Array.isArray(result?.chapters)
        ? result.chapters
        : [];

    return quranChaptersCache;
  };

const findExplicitVerseKeys = (
  message: string
): string[] => {
  const found: string[] = [];

  const pattern =
    /\b(?:quran|surah|chapter|verse|ayah|ayat)?\s*(\d{1,3})\s*:\s*(\d{1,3})\b/gi;

  for (const match of message.matchAll(pattern)) {
    const chapter = Number(match[1]);
    const verse = Number(match[2]);

    if (
      chapter >= 1 &&
      chapter <= 114 &&
      verse >= 1 &&
      verse <= 300
    ) {
      const key = `${chapter}:${verse}`;

      if (!found.includes(key)) {
        found.push(key);
      }
    }
  }

  return found.slice(0, 5);
};

const findMentionedChapter = async (
  message: string
): Promise<QuranChapter | null> => {
  const normalizedMessage =
    normalizeSearchText(message);

  const chapters =
    await getQuranChapters();

  const matches = chapters
    .map((chapter) => {
      const names = [
        chapter.name_simple,
        chapter.name_complex,
        chapter.translated_name?.name,
      ]
        .filter(
          (name): name is string =>
            typeof name === "string"
        )
        .map(normalizeSearchText)
        .filter(Boolean);

      const matchedLength = names.reduce(
        (longest, name) => {
          const variants = [
            name,
            name.replace(/^al\s+/, ""),
            name.replace(/^an\s+/, ""),
            name.replace(/^ar\s+/, ""),
            name.replace(/^as\s+/, ""),
            name.replace(/^at\s+/, ""),
          ].filter(
            (item) => item.length >= 3
          );

          const matchingVariant =
            variants.find((variant) =>
              normalizedMessage.includes(variant)
            );

          return matchingVariant
            ? Math.max(
                longest,
                matchingVariant.length
              )
            : longest;
        },
        0
      );

      return {
        chapter,
        matchedLength,
      };
    })
    .filter(
      (item) => item.matchedLength > 0
    )
    .sort(
      (a, b) =>
        b.matchedLength - a.matchedLength
    );

  return matches[0]?.chapter || null;
};

const getVerseByKey = async (
  verseKey: string,
  translationId: number
): Promise<QuranVerse | null> => {
  const result = await quranApiFetch(
    `/verses/by_key/${encodeURIComponent(
      verseKey
    )}?language=en&words=false&translations=${translationId}&fields=text_uthmani`
  );

  return result?.verse || null;
};

const buildQuranContext = async (
  message: string
): Promise<{
  context: string;
  references: string[];
}> => {
  const explicitVerseKeys =
    findExplicitVerseKeys(message);

  const translationId =
    await getEnglishTranslationId();

  let verseKeys = [...explicitVerseKeys];
  let mentionedChapter: QuranChapter | null =
    null;

  if (verseKeys.length === 0) {
    mentionedChapter =
      await findMentionedChapter(message);

    if (
      mentionedChapter?.id &&
      mentionedChapter.id >= 1 &&
      mentionedChapter.id <= 114
    ) {
      const versesToLoad = Math.min(
        mentionedChapter.verses_count || 3,
        mentionedChapter.id === 1 ? 7 : 5
      );

      verseKeys = Array.from(
        { length: versesToLoad },
        (_, index) =>
          `${mentionedChapter?.id}:${index + 1}`
      );
    }
  }

  if (verseKeys.length === 0) {
    return {
      context: "",
      references: [],
    };
  }

  const verseResults =
    await Promise.all(
      verseKeys.map(async (verseKey) => {
        try {
          return await getVerseByKey(
            verseKey,
            translationId
          );
        } catch (error) {
          console.error(
            `Unable to retrieve Quran verse ${verseKey}:`,
            error
          );

          return null;
        }
      })
    );

  const verifiedVerses = verseResults
    .filter(
      (verse): verse is QuranVerse =>
        Boolean(
          verse?.verse_key &&
            verse?.text_uthmani
        )
    )
    .map((verse) => {
      const translation =
        stripHtml(
          verse.translations?.[0]?.text
        );

      return {
        verseKey: verse.verse_key as string,
        arabic: verse.text_uthmani as string,
        translation,
      };
    });

  if (verifiedVerses.length === 0) {
    return {
      context: "",
      references: [],
    };
  }

  const chapterDescription =
    mentionedChapter
      ? `
Matched chapter:
- Chapter ${mentionedChapter.id}: ${
          mentionedChapter.name_simple ||
          "Unknown name"
        }
- Meaning: ${
          mentionedChapter.translated_name
            ?.name || "Not provided"
        }
- Verse count: ${
          mentionedChapter.verses_count ||
          "Unknown"
        }
`.trim()
      : "";

  const verseContext = verifiedVerses
    .map(
      (verse) => `
Reference: Quran ${verse.verseKey}
Arabic: ${verse.arabic}
Verified English translation: ${
        verse.translation ||
        "Translation unavailable"
      }
`.trim()
    )
    .join("\n\n");

  return {
    context: `
VERIFIED QURAN FOUNDATION DATA

${chapterDescription}

${verseContext}

Grounding rules:
- Treat the Quran references, Arabic text, and translations above as the verified source material.
- Do not alter or invent the Arabic wording.
- Cite the exact verse key shown above.
- Explain meaning separately from the translated wording.
- Do not claim that the supplied verses represent the entire chapter unless every verse of that chapter was supplied.
`.trim(),
    references: verifiedVerses.map(
      (verse) => verse.verseKey
    ),
  };
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
            "Please sign in to use Tariq AI.",
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
            "Please sign in to use Tariq AI.",
        },
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

    const history =
      validHistory(body?.history);

    const conversation = history
      .map(
        (item) =>
          `${
            item.role === "user"
              ? "User"
              : "Tariq AI"
          }: ${item.content}`
      )
      .join("\n\n");

    let quranContext = "";
    let quranReferences: string[] = [];

    try {
      const groundedQuran =
        await buildQuranContext(message);

      quranContext =
        groundedQuran.context;
      quranReferences =
        groundedQuran.references;
    } catch (error) {
      console.error(
        "Quran grounding was unavailable:",
        error
      );
    }

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
- Only quote Quran wording supplied in the VERIFIED QURAN FOUNDATION DATA section.
- When verified Quran data is supplied, cite its exact chapter-and-verse reference.
- If verified Quran data is not supplied, do not provide an exact Quran quotation from memory. Explain the concept without pretending that a quotation was verified.
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
${
  conversation
    ? `Previous conversation:\n${conversation}\n\n`
    : ""
}
User's current question:
${message}

${
  quranContext
    ? `${quranContext}\n`
    : `No verified Quran verse text was retrieved for this request. Do not invent or quote an exact Quran verse from memory.\n`
}
`.trim();

    const model =
      Deno.env.get("TARIQ_AI_MODEL") ||
      "gpt-5-mini";

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
          instructions:
            developerInstruction,
          input: prompt,
          reasoning: {
            effort: "low",
          },
          text: {
            verbosity: "low",
          },
          max_output_tokens: 1800,
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

    const topLevelOutput =
      typeof openAiResult?.output_text ===
      "string"
        ? openAiResult.output_text.trim()
        : "";

    const nestedOutput = Array.isArray(
      openAiResult?.output
    )
      ? openAiResult.output
          .flatMap((item: any) =>
            Array.isArray(item?.content)
              ? item.content
              : []
          )
          .filter(
            (content: any) =>
              content?.type ===
                "output_text" &&
              typeof content?.text ===
                "string"
          )
          .map((content: any) =>
            content.text.trim()
          )
          .filter(Boolean)
          .join("\n\n")
      : "";

    const rawAnswer =
      topLevelOutput || nestedOutput;

    if (!rawAnswer) {
      console.error(
        "Tariq AI returned no usable text:",
        {
          status: openAiResult?.status,
          incomplete_details:
            openAiResult
              ?.incomplete_details,
          output:
            openAiResult?.output,
        }
      );

      return jsonResponse(
        {
          error:
            openAiResult
              ?.incomplete_details
              ?.reason ===
            "max_output_tokens"
              ? "Tariq AI reached its response limit. Please try a shorter question."
              : "Tariq AI returned an empty response.",
        },
        502
      );
    }

    const categoryMatch =
      rawAnswer.match(
        /\n?Category:\s*(Quran|Hadith|Translation|Recommendation|Moderation|General)\s*$/i
      );

    const category = categoryMatch
      ? categoryMatch[1].toLowerCase()
      : quranReferences.length > 0
        ? "quran"
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
      quranReferences,
      quranGrounded:
        quranReferences.length > 0,
    });
  } catch (error) {
    console.error(
      "Tariq AI function error:",
      error
    );

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
