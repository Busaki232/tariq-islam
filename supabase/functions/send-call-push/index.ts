import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type FirebaseServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

function toBase64Url(bytes: Uint8Array) {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwtRS256(privateKeyPem: string, header: any, payload: any) {
  const enc = new TextEncoder();

  const headerB64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(data)
  );

  return `${data}.${toBase64Url(new Uint8Array(sig))}`;
}

async function getGoogleAccessToken(sa: FirebaseServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";

  const jwt = await signJwtRS256(
    sa.private_key,
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 60 * 55,
    }
  );

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Token exchange failed: ${resp.status} ${t}`);
  }

  const json = await resp.json();
  return json.access_token as string;
}

function buildCallUrlFromMetadata(meta: any) {
  const inviteId = meta?.invite_id || meta?.inviteId || "";
  const roomUrl = meta?.room_url || meta?.roomUrl || "";
  const callType = meta?.call_type || meta?.callType || "video";
  const conversationId = meta?.conversation_id || meta?.conversationId || "";
  const callerId =
    meta?.from_user_id || meta?.caller_id || meta?.callerId || "";
  const callerName = meta?.caller_name || meta?.callerName || "";

  if (!inviteId || !roomUrl) return null;

  const sp = new URLSearchParams();
  sp.set("inviteId", String(inviteId));
  sp.set("roomUrl", String(roomUrl));
  sp.set("callType", String(callType));

  if (conversationId) sp.set("conversationId", String(conversationId));
  if (callerId) sp.set("callerId", String(callerId));
  if (callerName) sp.set("callerName", String(callerName));

  return `tariqislam:/call?${sp.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

    const sa = JSON.parse(saJson) as FirebaseServiceAccount;
    const projectId =
      Deno.env.get("FIREBASE_PROJECT_ID") || sa.project_id;

    const { data: rows, error } = await admin
      .from("notification_queue")
      .select("id,user_id,title,body,metadata")
      .eq("is_sent", false)
      .eq("notification_type", "call")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(rows.map((r) => r.user_id))];

    const { data: tokensRows, error: tErr } = await admin
      .from("push_tokens")
      .select("user_id, token, platform")
      .in("user_id", userIds)
      .eq("platform", "android");

    if (tErr) throw tErr;

    const tokensByUser = new Map<string, string[]>();

    for (const tr of tokensRows || []) {
      if (!tr.token) continue;
      const list = tokensByUser.get(tr.user_id) || [];
      list.push(tr.token);
      tokensByUser.set(tr.user_id, list);
    }

    const accessToken = await getGoogleAccessToken(sa);

    const sentNotifIds: string[] = [];
    const fcmErrors: any[] = [];

    for (const n of rows) {
      const tokens = tokensByUser.get(n.user_id) || [];
      if (tokens.length === 0) continue;

      const meta = n.metadata || {};
      const callUrl = meta?.call_url || buildCallUrlFromMetadata(meta);

      for (const token of tokens) {
        const message = {
          message: {
            token,
            data: {
              type: "incoming_call",
              title: String(n.title || "Incoming call"),
              body: String(n.body || "Tap to answer"),
              call_url: callUrl || "",
              inviteId: String(meta?.invite_id || meta?.inviteId || ""),
              roomUrl: String(meta?.room_url || meta?.roomUrl || ""),
              callType: String(meta?.call_type || meta?.callType || "video"),
              conversationId: String(
                meta?.conversation_id || meta?.conversationId || ""
              ),
              callerId: String(
                meta?.from_user_id || meta?.caller_id || meta?.callerId || ""
              ),
              callerName: String(
                meta?.caller_name || meta?.callerName || ""
              ),
            },
            android: {
              priority: "HIGH",
              ttl: "30s",
            },
          },
        };

        const resp = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          }
        );

        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          fcmErrors.push({
            notifId: n.id,
            status: resp.status,
            body: txt,
          });
        }
      }

      sentNotifIds.push(n.id);
    }

    if (sentNotifIds.length > 0) {
      await admin
        .from("notification_queue")
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .in("id", sentNotifIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        queued: rows.length,
        marked_sent: sentNotifIds.length,
        fcmErrors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});