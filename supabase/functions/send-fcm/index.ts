import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(resBody: unknown, status = 200) {
  return new Response(JSON.stringify(resBody), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}

function b64url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const bin = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    bin.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signJwtRS256(privateKeyPem: string, header: any, payload: any) {
  const key = await importPrivateKey(privateKeyPem);
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${encHeader}.${encPayload}`);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data));
  return `${encHeader}.${encPayload}.${b64url(sig)}`;
}

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signJwtRS256(sa.private_key, header, payload);

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", jwt);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const j = await r.json();
  if (!r.ok) throw new Error(`oauth token error: ${r.status} ${JSON.stringify(j)}`);
  return j.access_token;
}

Deno.serve(async (req) => {
    console.log("SEND_FCM_TRIGGERED");
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const { user_id, title, body, metadata } = await req.json().catch(() => ({}));

    if (!user_id) {
      return cors(json({ error: "Missing user_id" }, 400));
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      return cors(json({ error: "Missing SUPABASE_URL" }, 500));
    }
    if (!serviceRole) {
      return cors(json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500));
    }

    const admin = createClient(supabaseUrl, serviceRole);

    const { data: tokensRows, error: tokErr } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", user_id)
      .eq("platform", "android");

    if (tokErr) throw tokErr;

    const tokens = (tokensRows || [])
      .map((r: any) => r?.token)
      .filter(Boolean);

    if (tokens.length === 0) {
      return cors(json({ ok: false, reason: "no_android_tokens" }, 200));
    }

    const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!saRaw) {
      return cors(json({ error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON" }, 500));
    }

    const sa = JSON.parse(saRaw);
    const accessToken = await getGoogleAccessToken(sa);
    const projectId = sa.project_id;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const dataPayload = {
      type: "incoming_call",
      title: String(title || "Incoming call"),
      body: String(body || "Tap to answer"),
      inviteId: String(metadata?.invite_id ?? metadata?.inviteId ?? ""),
      roomUrl: String(metadata?.room_url ?? metadata?.roomUrl ?? ""),
      callType: String(metadata?.call_type ?? metadata?.callType ?? "video"),
      conversationId: String(metadata?.conversation_id ?? metadata?.conversationId ?? ""),
      callerId: String(metadata?.from_user_id ?? metadata?.caller_id ?? metadata?.callerId ?? ""),
      callerName: String(metadata?.caller_name ?? metadata?.callerName ?? ""),
    };

    const results: any[] = [];
    let sent = 0;

    for (const token of tokens) {
      const msg = {
        message: {
          token,
          data: dataPayload,
          android: {
            priority: "HIGH",
            ttl: "30s",
          },
        },
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(msg),
      });

      const out = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        results.push({
          token: token.slice(0, 12),
          ok: false,
          error: out,
        });
      } else {
        sent += 1;
        results.push({
          token: token.slice(0, 12),
          ok: true,
          fcm: out,
        });
      }
    }
console.log("SEND_FCM_RESULTS", JSON.stringify({ sent, results }));
    return cors(json({ ok: true, sent, results }));
  } catch (e) {
    return cors(json({ error: String(e) }, 500));
    }
});
