// supabase/functions/notification-processor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PushTokenRow = {
  id: string;
  user_id: string;
  platform: string;
  token: string;
  updated_at?: string;
  created_at?: string;
};

type FirebaseServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

function buildCallDeepLinkFromMetadata(meta: any) {
  const inviteId = meta?.invite_id ?? meta?.inviteId ?? meta?.id ?? "";
  const roomUrl = meta?.room_url ?? meta?.roomUrl ?? "";
  const callType = meta?.call_type ?? meta?.callType ?? "video";
  const conversationId = meta?.conversation_id ?? meta?.conversationId ?? "";
  const callerId = meta?.caller_id ?? meta?.from_user_id ?? meta?.fromUserId ?? "";
  const callerName = meta?.caller_name ?? meta?.from_user_name ?? meta?.callerName ?? "";

  if (!inviteId || !roomUrl) return null;

  const sp = new URLSearchParams();
  sp.set("inviteId", String(inviteId));
  sp.set("roomUrl", String(roomUrl));
  sp.set("callType", String(callType));
  if (conversationId) sp.set("conversationId", String(conversationId));
  if (callerId) sp.set("callerId", String(callerId));
  if (callerName) sp.set("callerName", String(callerName));

  const deepLink = `tariqislam:/call?${sp.toString()}`;
  const hashRoute = `#/call?${sp.toString()}`;

  return { deepLink, hashRoute, params: Object.fromEntries(sp.entries()) };
}

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
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
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

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`OAuth token failed: ${resp.status} ${JSON.stringify(json)}`);
  }

  return json.access_token as string;
}

async function sendFcmV1(
  accessToken: string,
  projectId: string,
  token: string,
  payload: any
) {
  const message = {
    message: {
      token,
      ...payload,
    },
  };

  console.log("[notification-processor] sending FCM payload:", JSON.stringify(message));

  const res = await fetch(
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

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`FCM HTTP v1 ${res.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
    if (!saJson) {
      return new Response(
        JSON.stringify({ error: "Missing FCM_SERVICE_ACCOUNT_JSON env var" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const serviceAccount = JSON.parse(saJson) as FirebaseServiceAccount;
    const projectId = serviceAccount.project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Missing project_id in FCM_SERVICE_ACCOUNT_JSON" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);

    const nowIso = new Date().toISOString();
    console.log("[notification-processor] Processing queue at", nowIso);

    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("is_sent", false)
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[notification-processor] fetch error:", fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(JSON.stringify({ message: "No notifications to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const byUser = pendingNotifications.reduce((acc: Record<string, any[]>, n: any) => {
      const uid = String(n.user_id);
      if (!acc[uid]) acc[uid] = [];
      acc[uid].push(n);
      return acc;
    }, {});

    let processed = 0;
    let sent = 0;
    let skippedNoTokens = 0;

    for (const [userId, notifs] of Object.entries(byUser)) {
      const { data: preferences } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const notificationsEnabled = preferences?.notifications_enabled ?? true;
      if (!notificationsEnabled) {
        const ids = notifs.map((n: any) => n.id);
        await supabase
          .from("notification_queue")
          .update({ is_sent: true, sent_at: nowIso })
          .in("id", ids);
        processed += ids.length;
        continue;
      }

      const { data: tokens, error: tokErr } = await supabase
        .from("push_tokens")
        .select("id,user_id,platform,token,updated_at,created_at")
        .eq("user_id", userId)
        .eq("platform", "android")
        .limit(20);

      if (tokErr) {
        console.warn("[notification-processor] token fetch error", userId, tokErr);
        continue;
      }

      const tokenRows = (tokens || []) as PushTokenRow[];
      const deviceTokens = tokenRows.map((t) => t.token).filter(Boolean);

      if (deviceTokens.length === 0) {
        skippedNoTokens += notifs.length;
        console.log("[notification-processor] no android tokens for user", userId);
        continue;
      }

      for (const notif of notifs) {
        const type = String(notif.notification_type || "");
        const meta = notif.metadata || {};

        let payload: any;

        if (type === "call") {
          const link = buildCallDeepLinkFromMetadata(meta);

          if (!link) {
            console.warn("[notification-processor] call notif missing invite/room", notif.id);
            continue;
          }

          const callerName =
            meta?.caller_name ??
            meta?.from_user_name ??
            meta?.callerName ??
            "Someone";

          const callType = meta?.call_type ?? meta?.callType ?? "video";

          // Android call pushes should be data-only so MyFirebaseMessagingService
          // handles them even when app is swiped away.
          payload = {
            data: {
              type: "incoming_call",
              call_url: link.hashRoute,
              deeplink: link.deepLink,
              inviteId: link.params.inviteId,
              roomUrl: link.params.roomUrl,
              callType: link.params.callType,
              conversationId: link.params.conversationId || "",
              callerId: link.params.callerId || "",
              callerName: link.params.callerName || callerName,
            },
            android: {
              priority: "high",
              ttl: "30s",
            },
          };

          console.log(
            "[notification-processor] android incoming_call payload for notif",
            notif.id,
            JSON.stringify(payload)
          );
        } else {
          payload = {
            notification: {
              title: notif.title || "Notification",
              body: notif.body || "",
            },
            data: {
              type,
              ...(meta || {}),
            },
            android: {
              priority: "normal",
              ttl: "3600s",
              notification: {
                channel_id: "calls_v2",
                sound: "default",
                visibility: "PUBLIC",
              },
            },
          };
        }

        let anySuccess = false;

        for (const t of deviceTokens) {
          try {
            const fcmResult = await sendFcmV1(accessToken, projectId, t, payload);
            console.log("[notification-processor] FCM success:", JSON.stringify(fcmResult));
            anySuccess = true;
          } catch (e) {
            console.warn("[notification-processor] FCM failed token:", String(e));
          }
        }

        if (anySuccess) {
          const { error: updErr } = await supabase
            .from("notification_queue")
            .update({ is_sent: true, sent_at: new Date().toISOString() })
            .eq("id", notif.id);

          if (updErr) {
            console.warn("[notification-processor] failed to mark sent", notif.id, updErr);
          } else {
            sent += 1;
          }
        }

        processed += 1;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Notification processing finished",
        total_pending: pendingNotifications.length,
        processed,
        marked_sent: sent,
        skipped_no_tokens: skippedNoTokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[notification-processor] error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});