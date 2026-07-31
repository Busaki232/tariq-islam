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
        { error: "Missing authorization token." },
        401
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Server configuration is missing." },
        500
      );
    }

    const userClient = createClient(
      supabaseUrl,
      anonKey,
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
    const targetLanguageCode =
      body?.targetLanguageCode;

    if (
      typeof lectureId !== "string" ||
      !lectureId
    ) {
      return jsonResponse(
        { error: "Lecture ID is required." },
        400
      );
    }

    if (
      typeof targetLanguageCode !== "string" ||
      !targetLanguageCode
    ) {
      return jsonResponse(
        {
          error:
            "A translated caption language is required.",
        },
        400
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: lecture, error: lectureError } =
      await adminClient
        .from("scholar_lectures")
        .select("id,scholar_id")
        .eq("id", lectureId)
        .single();

    if (lectureError || !lecture) {
      return jsonResponse(
        { error: "Scholar lecture not found." },
        404
      );
    }

    const { data: scholar, error: scholarError } =
      await adminClient
        .from("scholar_profiles")
        .select(
          "id,user_id,verification_status,is_active"
        )
        .eq("id", lecture.scholar_id)
        .single();

    if (
      scholarError ||
      !scholar ||
      scholar.user_id !== user.id
    ) {
      return jsonResponse(
        {
          error:
            "You cannot create audio for this lecture.",
        },
        403
      );
    }

    if (
      scholar.verification_status !== "approved" ||
      scholar.is_active !== true
    ) {
      return jsonResponse(
        {
          error:
            "An active approved scholar account is required.",
        },
        403
      );
    }

    const {
      data: voiceProfile,
      error: voiceProfileError,
    } = await adminClient
      .from("scholar_voice_profiles")
      .select(
        "id,consent_granted_at,consent_revoked_at,status"
      )
      .eq("scholar_id", scholar.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (voiceProfileError) {
      throw voiceProfileError;
    }

    if (
      !voiceProfile ||
      !voiceProfile.consent_granted_at
    ) {
      return jsonResponse(
        {
          error:
            "Complete Voice Translation Setup before generating audio.",
        },
        422
      );
    }

    if (
      voiceProfile.consent_revoked_at ||
      voiceProfile.status === "revoked"
    ) {
      return jsonResponse(
        {
          error:
            "Voice consent has been revoked.",
        },
        422
      );
    }

    const {
      data: captionTranslation,
      error: translationError,
    } = await adminClient
      .from(
        "scholar_lecture_caption_translations"
      )
      .select(
        "id,lecture_id,language_code,language_name,updated_at"
      )
      .eq("lecture_id", lecture.id)
      .eq("language_code", targetLanguageCode)
      .maybeSingle();

    if (translationError) {
      throw translationError;
    }

    if (!captionTranslation) {
      return jsonResponse(
        {
          error:
            "Generate this caption translation before creating audio.",
        },
        422
      );
    }

    const { data: existingJob } =
      await adminClient
        .from(
          "scholar_lecture_audio_translations"
        )
        .select(
          "id,lecture_id,language_code,language_name,status,storage_path,error_message,updated_at"
        )
        .eq("lecture_id", lecture.id)
        .eq("language_code", targetLanguageCode)
        .maybeSingle();

    if (
      existingJob?.status === "processing" ||
      existingJob?.status === "ready"
    ) {
      return jsonResponse({
        job: existingJob,
        existing: true,
      });
    }

    const {
      data: queuedJob,
      error: queueError,
    } = await adminClient
      .from(
        "scholar_lecture_audio_translations"
      )
      .upsert(
        {
          lecture_id: lecture.id,
          caption_translation_id:
            captionTranslation.id,
          scholar_id: scholar.id,
          voice_profile_id: voiceProfile.id,
          requested_by: user.id,
          language_code:
            captionTranslation.language_code,
          language_name:
            captionTranslation.language_name,
          status: "queued",
          storage_path: null,
          duration_seconds: null,
          segment_manifest: [],
          provider: null,
          provider_model: null,
          source_translation_updated_at:
            captionTranslation.updated_at,
          generated_at: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "lecture_id,language_code",
        }
      )
      .select(
        "id,lecture_id,language_code,language_name,status,storage_path,error_message,updated_at"
      )
      .single();

    if (queueError) {
      throw queueError;
    }

    return jsonResponse({
      job: queuedJob,
      providerConnected: false,
      recordingTransmitted: false,
    });
  } catch (error) {
    console.error(
      "Voice translation queue error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected voice translation queue error.",
      },
      500
    );
  }
});
