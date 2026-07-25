import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse({ error: "Missing authorization token." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const body = await request.json();
    const reflectionId = body?.reflectionId;

    if (!reflectionId || typeof reflectionId !== "string") {
      return jsonResponse({ error: "Reflection ID is required." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: reflection, error: reflectionError } =
      await adminClient
        .from("reflection_videos")
        .select("id,user_id,video_url,language")
        .eq("id", reflectionId)
        .single();

    if (reflectionError || !reflection) {
      return jsonResponse({ error: "Reflection not found." }, 404);
    }

    if (reflection.user_id !== user.id) {
      return jsonResponse(
        { error: "You cannot generate captions for this reflection." },
        403
      );
    }

    const videoResponse = await fetch(reflection.video_url);

    if (!videoResponse.ok) {
      return jsonResponse(
        { error: "Could not download the reflection video." },
        502
      );
    }

const videoBytes = await videoResponse.arrayBuffer();

const contentType =
  videoResponse.headers.get("content-type")?.split(";")[0] ||
  "application/octet-stream";

const extensionByMimeType: Record<string, string> = {
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/mpga": "mpga",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/ogg": "ogg",
  "video/webm": "webm",
};

const fileExtension = extensionByMimeType[contentType];

if (!fileExtension) {
  console.error("Unsupported reflection media type:", {
    contentType,
    videoUrl: reflection.video_url,
  });

  return jsonResponse(
    {
      error:
        contentType === "video/quicktime"
          ? "This video is in Apple MOV format. Please convert or upload it as MP4 before generating captions."
          : `Unsupported video format: ${contentType}. Please upload an MP4, WebM, MPEG, M4A, MP3, WAV, OGG, or FLAC file.`,
    },
    415
  );
}

const mediaBlob = new Blob([videoBytes], {
  type: contentType,
});

const formData = new FormData();

formData.append(
  "file",
  mediaBlob,
  `reflection-${reflection.id}.${fileExtension}`
);
formData.append("model", "whisper-1");
formData.append("response_format", "verbose_json");
formData.append("timestamp_granularities[]", "segment");
const languageCodeByName: Record<string, string> = {
  English: "en",
  Arabic: "ar",
  French: "fr",
  Hausa: "ha",
};

const requestedLanguageCode =
  languageCodeByName[reflection.language];

if (
  requestedLanguageCode &&
  requestedLanguageCode !== "yo"
) {
  formData.append("language", requestedLanguageCode);
}
    const transcriptionResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: formData,
      }
    );

    const transcriptionResult =
      await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      console.error("OpenAI transcription error:", transcriptionResult);

      return jsonResponse(
        {
          error:
            transcriptionResult?.error?.message ||
            "Caption generation failed.",
        },
        transcriptionResponse.status
      );
    }

    const captionsText =
      typeof transcriptionResult?.text === "string"
        ? transcriptionResult.text.trim()
        : "";

        const captionsSegments = Array.isArray(
          transcriptionResult?.segments
        )
          ? transcriptionResult.segments
              .map(
                (
                  segment: {
                    start?: unknown;
                    end?: unknown;
                    text?: unknown;
                  },
                  index: number
                ) => ({
                  id: index,
                  start: Number(segment.start ?? 0),
                  end: Number(segment.end ?? 0),
                  text:
                    typeof segment.text === "string"
                      ? segment.text.trim()
                      : "",
                })
              )
              .filter(
                (segment: {
                  start: number;
                  end: number;
                  text: string;
                }) =>
                  segment.text &&
                  Number.isFinite(segment.start) &&
                  Number.isFinite(segment.end) &&
                  segment.end > segment.start
              )
          : [];

    if (!captionsText) {
      return jsonResponse(
        { error: "No speech was detected in the video." },
        422
      );
    }

 const {
   data: updatedReflection,
   error: updateError,
 } = await adminClient
   .from("reflection_videos")
   .update({
     captions_text: captionsText,
     captions_segments: captionsSegments,
     captions_enabled: true,
     captions_language: reflection.language || "en",
   })
   .eq("id", reflection.id)
   .select(
     "id,captions_text,captions_segments,captions_enabled,captions_language"
   )
   .single();

 if (updateError) {
   throw updateError;
 }

 if (!updatedReflection) {
   throw new Error(
     "Captions were generated but could not be saved."
   );
 }

return jsonResponse({
  captionsText: updatedReflection.captions_text,
  captionsSegments: updatedReflection.captions_segments,
  captionsLanguage:
    updatedReflection.captions_language || "en",
});

  } catch (error) {
    console.error("Caption generation error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected caption generation error.",
      },
      500
    );
  }
});