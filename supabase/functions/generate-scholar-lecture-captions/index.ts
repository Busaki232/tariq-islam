import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

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
    const lectureId = body?.lectureId;

    if (!lectureId || typeof lectureId !== "string") {
      return jsonResponse(
        { error: "Lecture ID is required." },
        400
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: lecture,
      error: lectureError,
    } = await adminClient
      .from("scholar_lectures")
      .select("id,scholar_id,video_url,language")
      .eq("id", lectureId)
      .single();

    if (lectureError || !lecture) {
      console.error(
        "Scholar lecture lookup failed:",
        lectureError
      );

      return jsonResponse(
        { error: "Scholar lecture not found." },
        404
      );
    }

    const {
      data: scholarProfile,
      error: scholarProfileError,
    } = await adminClient
      .from("scholar_profiles")
      .select(
        "id,user_id,verification_status,is_active"
      )
      .eq("id", lecture.scholar_id)
      .single();

    if (
      scholarProfileError ||
      !scholarProfile ||
      scholarProfile.user_id !== user.id
    ) {
      console.error(
        "Scholar ownership verification failed:",
        scholarProfileError
      );

      return jsonResponse(
        {
          error:
            "You cannot generate captions for this lecture.",
        },
        403
      );
    }

    if (
      scholarProfile.verification_status !==
        "approved" ||
      scholarProfile.is_active !== true
    ) {
      return jsonResponse(
        {
          error:
            "An active approved scholar account is required.",
        },
        403
      );
    }

    const videoResponse = await fetch(
      lecture.video_url
    );

    if (!videoResponse.ok) {
      return jsonResponse(
        {
          error:
            "Could not download the scholar lecture video.",
        },
        502
      );
    }

    const videoBytes =
      await videoResponse.arrayBuffer();

    const contentType =
      videoResponse.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase() ||
      "application/octet-stream";

    const extensionByMimeType: Record<
      string,
      string
    > = {
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

    const fileExtension =
      extensionByMimeType[contentType];

    if (!fileExtension) {
      console.error(
        "Unsupported scholar lecture media type:",
        {
          contentType,
          videoUrl: lecture.video_url,
        }
      );

      return jsonResponse(
        {
          error:
            contentType === "video/quicktime"
              ? "This lecture is in Apple MOV format. Convert or upload it as MP4 before generating captions."
              : `Unsupported video format: ${contentType}. Upload an MP4, WebM, MPEG, M4A, MP3, WAV, OGG, or FLAC file.`,
        },
        415
      );
    }

    const mediaBlob = new Blob(
      [videoBytes],
      {
        type: contentType,
      }
    );

    const formData = new FormData();

    formData.append(
      "file",
      mediaBlob,
      `scholar-lecture-${lecture.id}.${fileExtension}`
    );

    formData.append("model", "whisper-1");
    formData.append(
      "response_format",
      "verbose_json"
    );
    formData.append(
      "timestamp_granularities[]",
      "segment"
    );

    const languageCodeByName: Record<
      string,
      string
    > = {
      English: "en",
      Arabic: "ar",
      French: "fr",
      Hausa: "ha",
      Yoruba: "yo",
      Yorùbá: "yo",
      Urdu: "ur",
    };

    const requestedLanguageCode =
      lecture.language
        ? languageCodeByName[lecture.language]
        : undefined;

    if (
      requestedLanguageCode &&
      requestedLanguageCode !== "yo"
    ) {
      formData.append(
        "language",
        requestedLanguageCode
      );
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
      console.error(
        "OpenAI transcription error:",
        transcriptionResult
      );

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
      typeof transcriptionResult?.text ===
      "string"
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
        {
          error:
            "No speech was detected in the lecture.",
        },
        422
      );
    }

    const {
      data: updatedLecture,
      error: updateError,
    } = await adminClient
      .from("scholar_lectures")
      .update({
        captions_text: captionsText,
        captions_segments: captionsSegments,
        captions_enabled: true,
        captions_language:
          requestedLanguageCode ||
          lecture.language ||
          "original",
      })
      .eq("id", lecture.id)
      .select(
        "id,captions_text,captions_segments,captions_enabled,captions_language"
      )
      .single();

    if (updateError) {
      console.error(
        "Unable to save scholar lecture captions:",
        updateError
      );

      throw updateError;
    }

    if (!updatedLecture) {
      throw new Error(
        "Captions were generated but could not be saved."
      );
    }

    return jsonResponse({
      captionsText:
        updatedLecture.captions_text,
      captionsSegments:
        updatedLecture.captions_segments,
      captionsLanguage:
        updatedLecture.captions_language ||
        "original",
    });
  } catch (error) {
    console.error(
      "Scholar lecture caption generation error:",
      error
    );

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
