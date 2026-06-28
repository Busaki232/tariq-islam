// Insert notification for callee (recipient is to_user_id)

// If you don't have caller name in the invite row, keep it as "Caller"
const callerDisplayName =
  (invite as any)?.caller_name ||
  (invite as any)?.from_user_name ||
  "Caller";

const callUrl =
  `/call?inviteId=${encodeURIComponent(invite.id)}` +
  `&roomUrl=${encodeURIComponent(invite.room_url)}` +
  `&callType=${encodeURIComponent(invite.call_type || "video")}` +
  (invite.conversation_id
    ? `&conversationId=${encodeURIComponent(invite.conversation_id)}`
    : "") +
  `&callerId=${encodeURIComponent(invite.from_user_id)}` +
  `&callerName=${encodeURIComponent(callerDisplayName)}`;

const payload = {
  user_id: invite.to_user_id,
  notification_type: "call",

  // REQUIRED (notification_queue.title/body are NOT NULL in your DB)
  title: "Incoming call",
  body: `Incoming ${invite.call_type || "video"} call`,

  is_sent: false,

  metadata: {
    type: "call",

    // snake_case (DB / older client code)
    invite_id: invite.id,
    room_url: invite.room_url,
    call_type: invite.call_type,
    conversation_id: invite.conversation_id,
    from_user_id: invite.from_user_id,
    to_user_id: invite.to_user_id,
    caller_id: invite.from_user_id,
    callee_id: invite.to_user_id,

    // camelCase (matches your App.tsx buildCallUrlFromPush)
    inviteId: invite.id,
    roomUrl: invite.room_url,
    callType: invite.call_type || "video",
    conversationId: invite.conversation_id || "",
    callerId: invite.from_user_id || "",
    callerName: callerDisplayName,

    // convenience
    call_url: callUrl,
    callUrl,
  },
};

const { error: qErr } = await admin.from("notification_queue").insert(payload);