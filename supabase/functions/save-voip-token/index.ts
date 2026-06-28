import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, token, platform } = await req.json();

    if (!user_id) throw new Error("Missing user_id");
    if (!token) throw new Error("Missing token");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRole);
    const resolvedPlatform = platform || "ios_voip";

    const { error: delError } = await admin
      .from("push_tokens")
      .delete()
      .eq("user_id", user_id)
      .eq("platform", resolvedPlatform);

    if (delError) throw new Error(`Delete failed: ${JSON.stringify(delError)}`);

    const { error: insError } = await admin.from("push_tokens").insert({
      user_id,
      token,
      platform: resolvedPlatform,
      updated_at: new Date().toISOString(),
    });

    if (insError) throw new Error(`Insert failed: ${JSON.stringify(insError)}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});