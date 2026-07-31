import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supportedLanguages: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
  ha: "Hausa",
  yo: "Yorùbá",
  ur: "Urdu",
};

const nonTranslatableLabels = new Set([
  "photo",
  "video",
  "attachment",
  "🎤 voice message",
]);

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authorization =
      request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        { error: "Missing authorization token." },
        401
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey =
      Deno.env.get("OPENAI_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
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
      return jsonResponse(
        { error: "Unauthorized." },
        401
      );
    }

    const body = await request.json();
    const messageId = body?.messageId;
    const targetLanguageCode =
      body?.targetLanguageCode;

    if (
      !messageId ||
      typeof messageId !== "string"
    ) {
      return jsonResponse(
        { error: "Message ID is required." },
        400
      );
    }

    if (
      !targetLanguageCode ||
      typeof targetLanguageCode !== "string" ||
      !supportedLanguages[targetLanguageCode]
    ) {
      return jsonResponse(
        {
          error:
            "A supported target language is required.",
        },
        400
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: message,
      error: messageError,
    } = await adminClient
      .from("messages")
      .select(
        `
          id,
          sender_id,
          recipient_id,
          group_id,
          content,
          is_deleted
        `
      )
      .eq("id", messageId)
      .maybeSingle();

    if (
      messageError ||
      !message ||
      message.is_deleted
    ) {
      return jsonResponse(
        { error: "Message not found." },
        404
      );
    }

    let canAccess = false;

    if (message.group_id) {
      const {
        data: membership,
        error: membershipError,
      } = await adminClient
        .from("chat_group_members")
        .select("user_id")
        .eq("group_id", message.group_id)
        .eq("user_id", user.id)
        .maybeSingle();

      canAccess =
        !membershipError && Boolean(membership);
    } else {
      canAccess =
        message.recipient_id === user.id;
    }

    if (!canAccess) {
      return jsonResponse(
        {
          error:
            "You cannot translate this message.",
        },
        403
      );
    }

    const sourceText =
      typeof message.content === "string"
        ? message.content.trim()
        : "";

    if (
      !sourceText ||
      nonTranslatableLabels.has(
        sourceText.toLowerCase()
      )
    ) {
      return jsonResponse(
        {
          error:
            "This message does not contain translatable text.",
        },
        422
      );
    }

    if (sourceText.length > 5000) {
      return jsonResponse(
        {
          error:
            "This message is too long to translate.",
        },
        422
      );
    }

    const targetLanguageName =
      supportedLanguages[targetLanguageCode];

    const openAiResponse = await fetch(
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
              name: "message_translation",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  detected_language_code: {
                    type: "string",
                  },
                  detected_language_name: {
                    type: "string",
                  },
                  translated_text: {
                    type: "string",
                  },
                  already_target_language: {
                    type: "boolean",
                  },
                },
                required: [
                  "detected_language_code",
                  "detected_language_name",
                  "translated_text",
                  "already_target_language",
                ],
              },
            },
          },
          messages: [
            {
              role: "system",
              content:
                `Detect the source language and translate the message into ${targetLanguageName}. ` +
                "Preserve names, URLs, emojis, line breaks, meaning, and tone. " +
                "Do not add explanations. If the message is already in the target language, " +
                "return the original text and set already_target_language to true.",
            },
            {
              role: "user",
              content: sourceText,
            },
          ],
        }),
      }
    );

    if (!openAiResponse.ok) {
      const providerError =
        await openAiResponse.text();

      console.error(
        "OpenAI message translation failed:",
        providerError
      );

      return jsonResponse(
        {
          error:
            "The message could not be translated.",
        },
        502
      );
    }

    const providerData =
      await openAiResponse.json();

    const responseText =
      providerData?.choices?.[0]?.message?.content;

    if (
      !responseText ||
      typeof responseText !== "string"
    ) {
      return jsonResponse(
        {
          error:
            "The translation provider returned an invalid response.",
        },
        502
      );
    }

    const result = JSON.parse(responseText);

    return jsonResponse({
      messageId: message.id,
      targetLanguageCode,
      targetLanguageName,
      detectedLanguageCode:
        result.detected_language_code,
      detectedLanguageName:
        result.detected_language_name,
      translatedText:
        result.translated_text,
      alreadyTargetLanguage:
        result.already_target_language,
    });
  } catch (error) {
    console.error(
      "Unexpected message translation error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected translation error.",
      },
      500
    );
  }
});
