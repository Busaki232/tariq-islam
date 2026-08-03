import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateLivestreamBody = {
  scholarId?: string;
  title?: string;
  description?: string | null;
  sourceLanguage?: string;
  translationLanguages?: string[];
  scheduledFor?: string | null;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey ||
      !dailyApiKey
    ) {
      console.error("Missing required server environment variables.");

      return jsonResponse(
        { error: "Server configuration is incomplete." },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication is required." },
        401,
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const authenticatedClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await authenticatedClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Authentication failed:", userError);

      return jsonResponse(
        { error: "Your session is invalid or expired." },
        401,
      );
    }

    const body = (await req.json()) as CreateLivestreamBody;

    const scholarId = body.scholarId?.trim();
    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const sourceLanguage =
      body.sourceLanguage?.trim().toLowerCase() || "ar";

    const translationLanguages = Array.from(
      new Set(
        (body.translationLanguages ?? [])
          .map((language) => language.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (!scholarId) {
      return jsonResponse(
        { error: "Scholar ID is required." },
        400,
      );
    }

    if (!title) {
      return jsonResponse(
        { error: "Livestream title is required." },
        400,
      );
    }

    if (title.length > 200) {
      return jsonResponse(
        { error: "Livestream title cannot exceed 200 characters." },
        400,
      );
    }

    if (description && description.length > 5000) {
      return jsonResponse(
        {
          error:
            "Livestream description cannot exceed 5,000 characters.",
        },
        400,
      );
    }

    let scheduledFor: string | null = null;

    if (body.scheduledFor) {
      const scheduledDate = new Date(body.scheduledFor);

      if (Number.isNaN(scheduledDate.getTime())) {
        return jsonResponse(
          { error: "The scheduled livestream date is invalid." },
          400,
        );
      }

      scheduledFor = scheduledDate.toISOString();
    }

    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: scholar, error: scholarError } =
      await adminClient
        .from("scholar_profiles")
        .select(
          "id, user_id, display_name, verification_status, is_active",
        )
        .eq("id", scholarId)
        .eq("user_id", user.id)
        .eq("verification_status", "approved")
        .eq("is_active", true)
        .maybeSingle();

    if (scholarError) {
      console.error("Scholar verification query failed:", scholarError);

      return jsonResponse(
        { error: "Unable to verify the scholar profile." },
        500,
      );
    }

    if (!scholar) {
      return jsonResponse(
        {
          error:
            "Only the approved owner of this scholar profile can create a livestream.",
        },
        403,
      );
    }

    const { data: existingLivestream, error: existingError } =
      await adminClient
        .from("scholar_livestreams")
        .select("id, title, status")
        .eq("scholar_id", scholar.id)
        .in("status", ["upcoming", "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingError) {
      console.error(
        "Existing livestream lookup failed:",
        existingError,
      );

      return jsonResponse(
        { error: "Unable to check existing livestreams." },
        500,
      );
    }

    if (existingLivestream) {
      return jsonResponse(
        {
          error:
            "This scholar already has an active or scheduled livestream.",
          existingLivestream,
        },
        409,
      );
    }

    const livestreamId = crypto.randomUUID();
    const compactId = livestreamId.replaceAll("-", "").slice(0, 18);
    const roomName = `scholar-${compactId}`;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const roomExpirationSeconds =
      scheduledFor
        ? Math.floor(new Date(scheduledFor).getTime() / 1000) +
          12 * 60 * 60
        : nowSeconds + 12 * 60 * 60;

    const dailyResponse = await fetch(
      "https://api.daily.co/v1/rooms",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dailyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp: roomExpirationSeconds,
            eject_at_room_exp: true,
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: true,
            start_audio_off: true,
          },
        }),
      },
    );

    const dailyResult = await dailyResponse.json();

    if (!dailyResponse.ok) {
      console.error("Daily room creation failed:", dailyResult);

      return jsonResponse(
        {
          error: "Unable to create the livestream room.",
          dailyStatus: dailyResponse.status,
        },
        502,
      );
    }

    const initialStatus = scheduledFor ? "upcoming" : "draft";

    const { data: livestream, error: insertError } =
      await adminClient
        .from("scholar_livestreams")
        .insert({
          id: livestreamId,
          scholar_id: scholar.id,
          created_by: user.id,
          title,
          description,
          daily_room_name: dailyResult.name,
          daily_room_url: dailyResult.url,
          source_language: sourceLanguage,
          translation_languages: translationLanguages,
          scheduled_for: scheduledFor,
          status: initialStatus,
        })
        .select("*")
        .single();

    if (insertError) {
      console.error("Livestream insert failed:", insertError);

      try {
        await fetch(
          `https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${dailyApiKey}`,
            },
          },
        );
      } catch (cleanupError) {
        console.error(
          "Failed to clean up Daily room:",
          cleanupError,
        );
      }

      return jsonResponse(
        { error: "Unable to save the livestream." },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        livestream,
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected create livestream error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      500,
    );
  }
});
