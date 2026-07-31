import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  livestreamId?: string;
  action?: "start" | "end";
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
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey
    ) {
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
      return jsonResponse(
        { error: "Your session is invalid or expired." },
        401,
      );
    }

    const body = (await req.json()) as RequestBody;
    const livestreamId = body.livestreamId?.trim();
    const action = body.action;

    if (!livestreamId) {
      return jsonResponse(
        { error: "Livestream ID is required." },
        400,
      );
    }

    if (action !== "start" && action !== "end") {
      return jsonResponse(
        { error: 'Action must be either "start" or "end".' },
        400,
      );
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

    const { data: livestream, error: livestreamError } =
      await adminClient
        .from("scholar_livestreams")
        .select(`
          id,
          scholar_id,
          created_by,
          title,
          status,
          started_at,
          ended_at,
          daily_room_name,
          daily_room_url
        `)
        .eq("id", livestreamId)
        .maybeSingle();

    if (livestreamError) {
      console.error("Livestream lookup failed:", livestreamError);

      return jsonResponse(
        { error: "Unable to load the livestream." },
        500,
      );
    }

    if (!livestream) {
      return jsonResponse(
        { error: "Livestream not found." },
        404,
      );
    }

    const { data: scholar, error: scholarError } =
      await adminClient
        .from("scholar_profiles")
        .select(
          "id, user_id, verification_status, is_active",
        )
        .eq("id", livestream.scholar_id)
        .maybeSingle();

    if (scholarError || !scholar) {
      console.error("Scholar lookup failed:", scholarError);

      return jsonResponse(
        { error: "Unable to verify the scholar." },
        500,
      );
    }

    const isScholarOwner =
      scholar.user_id === user.id &&
      scholar.verification_status === "approved" &&
      scholar.is_active === true;

    let isAdminOrModerator = false;

    if (!isScholarOwner) {
      const { data: roleRows, error: roleError } =
        await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "moderator"]);

      if (roleError) {
        console.error("Role lookup failed:", roleError);
      }

      isAdminOrModerator = (roleRows?.length ?? 0) > 0;
    }

    if (!isScholarOwner && !isAdminOrModerator) {
      return jsonResponse(
        {
          error:
            "Only the scholar owner, an admin, or a moderator can update this livestream.",
        },
        403,
      );
    }

    const now = new Date().toISOString();

    if (action === "start") {
      if (!["draft", "upcoming"].includes(livestream.status)) {
        return jsonResponse(
          {
            error:
              "Only draft or upcoming livestreams can be started.",
            currentStatus: livestream.status,
          },
          409,
        );
      }

      const { data: activeLivestream, error: activeError } =
        await adminClient
          .from("scholar_livestreams")
          .select("id, title")
          .eq("scholar_id", livestream.scholar_id)
          .eq("status", "live")
          .neq("id", livestream.id)
          .limit(1)
          .maybeSingle();

      if (activeError) {
        console.error(
          "Active livestream lookup failed:",
          activeError,
        );

        return jsonResponse(
          { error: "Unable to check active livestreams." },
          500,
        );
      }

      if (activeLivestream) {
        return jsonResponse(
          {
            error:
              "This scholar already has another live broadcast.",
            activeLivestream,
          },
          409,
        );
      }

      const { data: updated, error: updateError } =
        await adminClient
          .from("scholar_livestreams")
          .update({
            status: "live",
            started_at: livestream.started_at ?? now,
            ended_at: null,
          })
          .eq("id", livestream.id)
          .in("status", ["draft", "upcoming"])
          .select("*")
          .single();

      if (updateError) {
        console.error("Start livestream failed:", updateError);

        return jsonResponse(
          { error: "Unable to start the livestream." },
          500,
        );
      }

      return jsonResponse({
        success: true,
        action: "start",
        livestream: updated,
      });
    }

    if (livestream.status !== "live") {
      return jsonResponse(
        {
          error: "Only a live broadcast can be ended.",
          currentStatus: livestream.status,
        },
        409,
      );
    }

    const { data: updated, error: updateError } =
      await adminClient
        .from("scholar_livestreams")
        .update({
          status: "ended",
          ended_at: now,
        })
        .eq("id", livestream.id)
        .eq("status", "live")
        .select("*")
        .single();

    if (updateError) {
      console.error("End livestream failed:", updateError);

      return jsonResponse(
        { error: "Unable to end the livestream." },
        500,
      );
    }

    return jsonResponse({
      success: true,
      action: "end",
      livestream: updated,
    });
  } catch (error) {
    console.error(
      "Unexpected livestream status error:",
      error,
    );

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
