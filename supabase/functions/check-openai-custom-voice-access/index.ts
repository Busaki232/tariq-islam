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
    const scholarId = body?.scholarId;

    if (!scholarId || typeof scholarId !== "string") {
      return jsonResponse(
        { error: "Scholar ID is required." },
        400
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: scholar,
      error: scholarError,
    } = await adminClient
      .from("scholar_profiles")
      .select(
        "id,user_id,verification_status,is_active"
      )
      .eq("id", scholarId)
      .eq("user_id", user.id)
      .eq("verification_status", "approved")
      .eq("is_active", true)
      .maybeSingle();

    if (scholarError || !scholar) {
      return jsonResponse(
        {
          error:
            "An active approved scholar account is required.",
        },
        403
      );
    }

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/audio/voice_consents?limit=1",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
      }
    );

    let result: unknown = null;

    try {
      result = await openAiResponse.json();
    } catch {
      result = null;
    }

    if (openAiResponse.ok) {
      return jsonResponse({
        eligible: true,
        message:
          "OpenAI Custom Voice access is available.",
      });
    }

    const upstreamMessage =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof (result as {
        error?: { message?: unknown };
      }).error?.message === "string"
        ? (result as {
            error: { message: string };
          }).error.message
        : "Custom Voice access is not currently available.";

    if (
      openAiResponse.status === 403 ||
      openAiResponse.status === 404
    ) {
      return jsonResponse({
        eligible: false,
        message: upstreamMessage,
      });
    }

    console.error(
      "OpenAI Custom Voice access check failed:",
      {
        status: openAiResponse.status,
        result,
      }
    );

    return jsonResponse(
      {
        error:
          "Unable to verify OpenAI Custom Voice access.",
        providerStatus: openAiResponse.status,
      },
      502
    );
  } catch (error) {
    console.error(
      "Custom Voice access check error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected access check error.",
      },
      500
    );
  }
});
