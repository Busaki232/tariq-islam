// supabase/functions/mark-missed-calls/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRole);

    // mark calls older than 30s as missed
    const cutoff = new Date(Date.now() - 30_000).toISOString();

    // 1) find ringing invites that are too old
    const { data: rows, error: fetchErr } = await admin
      .from("call_invites")
      .select("id, caller_id, callee_id, call_type, room_url, conversation_id, created_at")
      .eq("status", "ringing")
      .lte("created_at", cutoff)
      .limit(200);

    if (fetchErr) throw fetchErr;

    const invites = rows ?? [];
    if (invites.length === 0) {
      return new Response(JSON.stringify({ ok: true, missed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = invites.map((r) => r.id);

    // 2) update them to missed
    const { error: updErr } = await admin
      .from("call_invites")
      .update({
        status: "missed",
        ended_at: new Date().toISOString(),
        ended_reason: "missed",
      })
      .in("id", ids);

    if (updErr) throw updErr;

    // 3) optional: add notification_queue rows (caller gets missed notification)
    // If you don’t want notifications here, delete this block.
    const notifRows = invites.map((inv) => ({
      user_id: inv.caller_id,
      notification_type: "call",
      title: "Missed call",
      body: `No answer (${inv.call_type || "video"} call)`,
      is_sent: false,
      metadata: {
        type: "call_missed",
        invite_id: inv.id,
        callee_id: inv.callee_id,
        call_type: inv.call_type,
        conversation_id: inv.conversation_id,
      },
    }));

    // If your notification_queue requires scheduled_at etc, adjust accordingly.
    await admin.from("notification_queue").insert(notifRows).catch(() => null);

    return new Response(JSON.stringify({ ok: true, missed: invites.length, ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});