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

const extractStoragePath = (
  publicUrl: string | null,
  bucketName: string
) => {
  if (!publicUrl) return null;

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  return decodeURIComponent(
    publicUrl.slice(markerIndex + marker.length)
  );
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
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

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: roleRows, error: roleError } =
      await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

    if (roleError) throw roleError;

    const isAuthorized = (roleRows ?? []).some(
      (row) =>
        row.role === "admin" || row.role === "moderator"
    );

    if (!isAuthorized) {
      return jsonResponse(
        { error: "Admin or moderator access required." },
        403
      );
    }

    const body = await request.json();
    const reflectionId = body?.reflectionId;

    if (!reflectionId || typeof reflectionId !== "string") {
      return jsonResponse(
        { error: "Reflection ID is required." },
        400
      );
    }

    const { data: reflection, error: reflectionError } =
      await adminClient
        .from("reflection_videos")
        .select("id,title,video_url,thumbnail_url")
        .eq("id", reflectionId)
        .single();

    if (reflectionError || !reflection) {
      return jsonResponse(
        { error: "Reflection not found." },
        404
      );
    }

    const filesToRemove = [
      extractStoragePath(
        reflection.video_url,
        "reflection-videos"
      ),
      extractStoragePath(
        reflection.thumbnail_url,
        "reflection-videos"
      ),
    ].filter((path): path is string => Boolean(path));

    const { data: deletedRows, error: deleteError } =
      await adminClient
        .from("reflection_videos")
        .delete()
        .eq("id", reflectionId)
        .select("id,title");

    if (deleteError) throw deleteError;

    if (!deletedRows || deletedRows.length === 0) {
      return jsonResponse(
        { error: "The reflection was not deleted." },
        409
      );
    }

    if (filesToRemove.length > 0) {
      const { error: storageError } =
        await adminClient.storage
          .from("reflection-videos")
          .remove(filesToRemove);

      if (storageError) {
        console.error(
          "Reflection storage cleanup error:",
          storageError
        );
      }
    }

    return jsonResponse({
      success: true,
      deletedReflection: deletedRows[0],
    });
  } catch (error) {
    console.error("Admin reflection deletion error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected deletion error.",
      },
      500
    );
  }
});
