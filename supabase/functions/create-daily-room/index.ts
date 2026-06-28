import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = Record<string, unknown>;

function corsHeaders(origin: string | null) {
  // You can lock this down later. For now keep it permissive to stop Android https://localhost issues.
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status: number, body: Json, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function mustEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function safeRoomName(raw: unknown) {
  const base = String(raw || "").trim() || `call-${Date.now()}`;
  // Daily room names: keep simple
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const supabaseUrl = mustEnv("SUPABASE_URL");
    const anonKey = mustEnv("SUPABASE_ANON_KEY");
    const dailyApiKey = mustEnv("DAILY_API_KEY");
    const dailyDomain = mustEnv("DAILY_DOMAIN"); // example: global-muslims-connec.daily.co

    // Verify user (so random people cannot create rooms)
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: "Unauthorized" }, origin);
    }

    const body = await req.json().catch(() => ({}));
    const callType = String((body as any)?.callType || "video").toLowerCase();
    const roomName = safeRoomName((body as any)?.roomName);

    const dailyCreateUrl = "https://api.daily.co/v1/rooms";
    const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

    const createPayload = {
      name: roomName,
      privacy: "public",
      properties: {
        exp,
        enable_prejoin_ui: true,
        start_video_off: callType === "audio",
        start_audio_off: false,
        // If you use Daily prebuilt UI, this is safe.
        // If you are embedding daily-js (you are), still fine.
      },
    };

    const res = await fetch(dailyCreateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return json(
        500,
        { error: "Daily room create failed", status: res.status, details: text.slice(0, 400) },
        origin
      );
    }

    const data = JSON.parse(text) as any;

    const roomUrl =
      typeof data?.url === "string" && data.url.trim()
        ? data.url.trim()
        : `https://${dailyDomain}/${roomName}`;

    return json(200, { roomUrl, roomName }, origin);
  } catch (e) {
    return json(500, { error: String(e) }, origin);
  }
});