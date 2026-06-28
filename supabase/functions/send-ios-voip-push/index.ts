import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function toBase64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createApnsJwt() {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const p8 = Deno.env.get("APNS_KEY_P8");

  if (!keyId) throw new Error("Missing APNS_KEY_ID");
  if (!teamId) throw new Error("Missing APNS_TEAM_ID");
  if (!p8) throw new Error("Missing APNS_KEY_P8");

  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(p8),
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"]
  );

  const derSignature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput)
    )
  );

  return `${signingInput}.${toBase64Url(derSignature)}`;
}

function buildCallPayload(meta: any, title?: string, body?: string) {
  const inviteId = String(meta?.invite_id ?? meta?.inviteId ?? "");
  const roomUrl = String(meta?.room_url ?? meta?.roomUrl ?? "");
  const callType = String(meta?.call_type ?? meta?.callType ?? "video");
  const conversationId = String(meta?.conversation_id ?? meta?.conversationId ?? "");
  const callerId = String(meta?.from_user_id ?? meta?.caller_id ?? meta?.callerId ?? "");
  const callerName = String(meta?.caller_name ?? meta?.callerName ?? "Someone");

  if (!inviteId || !roomUrl) {
    throw new Error("Missing invite_id/inviteId or room_url/roomUrl");
  }

  return {
    aps: {
      "content-available": 1,
      alert: {
        title: title || `Incoming ${callType} call`,
        body: body || `from ${callerName}`,
      },
      sound: "default",
    },
    type: "call",
    inviteId,
    roomUrl,
    callType,
    conversationId,
    callerId,
    callerName,
  };
}

async function postApns(
  host: string,
  token: string,
  jwt: string,
  bundleId: string,
  payload: any
) {
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": `${bundleId}.voip`,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`APNs ${host} ${res.status}: ${text}`);
  }
}

async function sendApnsVoip(token: string, payload: any) {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) throw new Error("Missing APNS_BUNDLE_ID");

  const jwt = await createApnsJwt();

  try {
    await postApns("api.push.apple.com", token, jwt, bundleId, payload);
    console.log("APNS_PRODUCTION_SUCCESS");
  } catch (prodErr) {
    console.warn("APNS production failed, falling back to SANDBOX");
    await postApns("api.sandbox.push.apple.com", token, jwt, bundleId, payload);
    console.log("APNS_SANDBOX_SUCCESS");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRole);

    const { user_id, title, body, metadata } = await req.json();

    console.log("VOIP_PUSH_START", { user_id });

    if (!user_id) throw new Error("Missing user_id");
    if (!metadata) throw new Error("Missing metadata");

    const { data: tokens, error: tokErr } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", user_id)
      .eq("platform", "ios_voip");

    if (tokErr) throw tokErr;

    const deviceTokens = (tokens || [])
      .map((r: any) => r?.token)
      .filter(Boolean);

    console.log("VOIP_TOKENS_FOUND", deviceTokens.length);

    if (deviceTokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_ios_voip_tokens" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const payload = buildCallPayload(metadata, title, body);

    let sent = 0;
    const errors: string[] = [];

    for (const token of deviceTokens) {
      try {
        console.log("VOIP_SENDING_TO", token.slice(0, 12));
        await sendApnsVoip(token, payload);
        sent += 1;
        errors.push(`SUCCESS:${token.slice(0, 12)}`);
      } catch (e) {
        console.error("APNS_ERROR", e);
        errors.push(String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});