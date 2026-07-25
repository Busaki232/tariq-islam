import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CaptionSegment = {
  id?: number;
  start: number;
  end: number;
  text: string;
};

type TranslatedSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Translation function is running.",
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
});
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        { error: "Missing authorization token." },
        401
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !openAiKey
    ) {
      return jsonResponse(
        { error: "Required server configuration is missing." },
        500
      );
    }

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const body = await request.json();

    const reflectionId = body?.reflectionId;
    const targetLanguageCode = body?.targetLanguageCode;

    if (!reflectionId || typeof reflectionId !== "string") {
      return jsonResponse(
        { error: "Reflection ID is required." },
        400
      );
    }

    if (
      !targetLanguageCode ||
      typeof targetLanguageCode !== "string" ||
      !supportedLanguages[targetLanguageCode]
    ) {
      return jsonResponse(
        { error: "A supported target language is required." },
        400
      );
    }

    const targetLanguageName =
      supportedLanguages[targetLanguageCode];

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: reflection, error: reflectionError } =
      await adminClient
        .from("reflection_videos")
        .select(
          "id,user_id,captions_text,captions_segments,captions_language"
        )
        .eq("id", reflectionId)
        .single();

    if (reflectionError || !reflection) {
      return jsonResponse(
        { error: "Reflection not found." },
        404
      );
    }

    if (reflection.user_id !== user.id) {
      return jsonResponse(
        {
          error:
            "You cannot generate translations for this reflection.",
        },
        403
      );
    }

    const sourceSegments = Array.isArray(
      reflection.captions_segments
    )
      ? (reflection.captions_segments as CaptionSegment[])
          .map((segment, index) => ({
            id:
              typeof segment.id === "number"
                ? segment.id
                : index,
            start: Number(segment.start),
            end: Number(segment.end),
            text:
              typeof segment.text === "string"
                ? segment.text.trim()
                : "",
          }))
          .filter(
            (segment) =>
              segment.text &&
              Number.isFinite(segment.start) &&
              Number.isFinite(segment.end) &&
              segment.end > segment.start
          )
      : [];

    if (sourceSegments.length === 0) {
      return jsonResponse(
        {
          error:
            "Generate timed captions before generating translations.",
        },
        422
      );
    }

    const sourceLanguage =
      reflection.captions_language || "Original language";

    const translationResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "reflection_caption_translation",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  segments: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        id: {
                          type: "integer",
                        },
                        text: {
                          type: "string",
                        },
                      },
                      required: ["id", "text"],
                    },
                  },
                },
                required: ["segments"],
              },
            },
          },
          messages: [
            {
              role: "system",
              content:
                `Translate Islamic video captions from ${sourceLanguage} into ${targetLanguageName}. ` +
                "Translate accurately and naturally. Preserve Islamic names and terms carefully, including Allah, Quran, Hadith, Salah, Zakat, Surah names, Prophet names, and Arabic religious expressions. " +
                "Do not add explanations, commentary, transliteration, timestamps, or extra segments. " +
                "Return exactly one translated item for every input segment, using the same numeric id.",
            },
            {
              role: "user",
              content: JSON.stringify({
                segments: sourceSegments.map((segment) => ({
                  id: segment.id,
                  text: segment.text,
                })),
              }),
            },
          ],
        }),
      }
    );

    const translationResult =
      await translationResponse.json();

    if (!translationResponse.ok) {
      console.error(
        "OpenAI translation error:",
        translationResult
      );

      return jsonResponse(
        {
          error:
            translationResult?.error?.message ||
            "Translation generation failed.",
        },
        translationResponse.status
      );
    }

    const responseContent =
      translationResult?.choices?.[0]?.message?.content;

    if (typeof responseContent !== "string") {
      return jsonResponse(
        { error: "No translation was returned." },
        502
      );
    }

    let parsedTranslation: {
      segments?: Array<{
        id?: unknown;
        text?: unknown;
      }>;
    };

    try {
      parsedTranslation = JSON.parse(responseContent);
    } catch {
      return jsonResponse(
        { error: "The translation response was invalid." },
        502
      );
    }

    const translatedById = new Map<number, string>();

    if (Array.isArray(parsedTranslation.segments)) {
      for (const segment of parsedTranslation.segments) {
        const id = Number(segment.id);
        const text =
          typeof segment.text === "string"
            ? segment.text.trim()
            : "";

        if (Number.isInteger(id) && text) {
          translatedById.set(id, text);
        }
      }
    }

    const translatedSegments: TranslatedSegment[] =
      sourceSegments.map((segment) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: translatedById.get(segment.id) || segment.text,
      }));

    const translatedText = translatedSegments
      .map((segment) => segment.text)
      .join(" ")
      .trim();

    if (!translatedText) {
      return jsonResponse(
        { error: "The translated text was empty." },
        502
      );
    }

    const { data: savedTranslation, error: saveError } =
      await adminClient
        .from("reflection_caption_translations")
        .upsert(
          {
            reflection_id: reflection.id,
            user_id: user.id,
            language_code: targetLanguageCode,
            language_name: targetLanguageName,
            translated_text: translatedText,
            translated_segments: translatedSegments,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "reflection_id,language_code",
          }
        )
        .select(
          "id,reflection_id,language_code,language_name,translated_text,translated_segments"
        )
        .single();

    if (saveError) {
      throw saveError;
    }

    return jsonResponse({
      translation: savedTranslation,
    });
  } catch (error) {
    console.error("Translation generation error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected translation generation error.",
      },
      500
    );
  }
});