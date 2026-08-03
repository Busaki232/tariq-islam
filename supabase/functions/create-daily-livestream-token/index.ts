import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestedRole = "viewer" | "guest";

type RequestBody = {
  livestreamId?: string;
  requestedRole?: RequestedRole;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
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
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey ||
      !dailyApiKey
    ) {
      return jsonResponse(
        { error: "Server configuration is incomplete." },
        500
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authenticatedClient.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(
        { error: "Your session is invalid or expired." },
        401
      );
    }

    const body = (await req.json()) as RequestBody;
    const livestreamId = body.livestreamId?.trim();

    const requestedRole: RequestedRole =
      body.requestedRole === "guest" ? "guest" : "viewer";

    if (!livestreamId) {
      return jsonResponse({ error: "Livestream ID is required." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: livestream, error: livestreamError } = await adminClient
      .from("scholar_livestreams")
      .select(
        `
          id,
          scholar_id,
          created_by,
          title,
          daily_room_name,
          daily_room_url,
          status,
          scheduled_for,
          ended_at
        `
      )
      .eq("id", livestreamId)
      .maybeSingle();

    if (livestreamError) {
      console.error("Livestream lookup failed:", livestreamError);

      return jsonResponse({ error: "Unable to load the livestream." }, 500);
    }

    if (!livestream) {
      return jsonResponse({ error: "Livestream not found." }, 404);
    }

    if (livestream.status === "ended" || livestream.ended_at) {
      return jsonResponse({ error: "This livestream has ended." }, 410);
    }

    const { data: scholar, error: scholarError } = await adminClient
      .from("scholar_profiles")
      .select("id, user_id, display_name, verification_status, is_active")
      .eq("id", livestream.scholar_id)
      .maybeSingle();

    if (scholarError || !scholar) {
      console.error("Scholar lookup failed:", scholarError);

      return jsonResponse({ error: "Unable to verify the scholar." }, 500);
    }

    const isScholarOwner =
      scholar.user_id === user.id &&
      scholar.verification_status === "approved" &&
      scholar.is_active === true;

    // Only the verified owner of this scholar profile may
    // broadcast. Admins and moderators join as viewers unless
    // they have an approved guest request.
    const isBroadcaster = isScholarOwner;

    let isApprovedGuest = false;

    if (!isBroadcaster && requestedRole === "guest") {
      const { data: blockRecord, error: blockLookupError } = await adminClient
        .from("scholar_livestream_blocks")
        .select("id")
        .eq("scholar_id", livestream.scholar_id)
        .eq("blocked_user_id", user.id)
        .maybeSingle();

      if (blockLookupError) {
        console.error("Livestream block lookup failed:", blockLookupError);

        return jsonResponse(
          {
            error: "Unable to verify your guest access.",
          },
          500
        );
      }

      if (!blockRecord) {
        const { data: approvedRequest, error: approvedRequestError } =
          await adminClient
            .from("scholar_livestream_join_requests")
            .select("id, status, requester_id, livestream_id")
            .eq("livestream_id", livestream.id)
            .eq("requester_id", user.id)
            .eq("status", "approved")
            .maybeSingle();

        if (approvedRequestError) {
          console.error("Approved guest lookup failed:", approvedRequestError);

          return jsonResponse(
            {
              error: "Unable to verify your guest approval.",
            },
            500
          );
        }

        isApprovedGuest = Boolean(approvedRequest);
      }
    }

    const assignedRole: "broadcaster" | "guest" | "viewer" = isBroadcaster
      ? "broadcaster"
      : isApprovedGuest
      ? "guest"
      : "viewer";

    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenExpiration = nowSeconds + 6 * 60 * 60;

    const participantName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (assignedRole === "guest" ? "Guest" : "Viewer");

    const tokenProperties =
      assignedRole === "broadcaster"
        ? {
            room_name: livestream.daily_room_name,
            user_id: user.id,
            user_name: scholar.display_name || "Scholar",
            is_owner: true,
            exp: tokenExpiration,
            eject_at_token_exp: true,
            start_audio_off: true,
            start_video_off: true,
            permissions: {
              hasPresence: true,
              canSend: ["audio", "video", "screenAudio", "screenVideo"],
              canReceive: {
                base: true,
              },
              canAdmin: true,
            },
          }
        : assignedRole === "guest"
        ? {
            room_name: livestream.daily_room_name,
            user_id: user.id,
            user_name: participantName,
            is_owner: false,
            exp: tokenExpiration,
            eject_at_token_exp: true,
            start_audio_off: true,
            start_video_off: true,
            enable_screenshare: false,
            permissions: {
              hasPresence: true,
              canSend: ["audio", "video"],
              canReceive: {
                base: true,
              },
              canAdmin: false,
            },
          }
        : {
            room_name: livestream.daily_room_name,
            user_id: user.id,
            user_name: participantName,
            is_owner: false,
            exp: tokenExpiration,
            eject_at_token_exp: true,
            start_audio_off: true,
            start_video_off: true,
            enable_screenshare: false,
            permissions: {
              hasPresence: true,
              canSend: false,
              canReceive: {
                base: true,
              },
              canAdmin: false,
            },
          };

    const dailyResponse = await fetch(
      "https://api.daily.co/v1/meeting-tokens",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dailyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: tokenProperties,
        }),
      }
    );

    const dailyResult = await dailyResponse.json();

    if (!dailyResponse.ok || !dailyResult.token) {
      console.error("Daily token creation failed:", dailyResult);

      return jsonResponse(
        {
          error: "Unable to create the meeting token.",
          dailyStatus: dailyResponse.status,
        },
        502
      );
    }

    return jsonResponse({
      success: true,
      token: dailyResult.token,
      roomUrl: livestream.daily_room_url,
      roomName: livestream.daily_room_name,
      role: assignedRole,
      livestream: {
        id: livestream.id,
        title: livestream.title,
        status: livestream.status,
      },
    });
  } catch (error) {
    console.error("Unexpected livestream token error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      500
    );
  }
});
