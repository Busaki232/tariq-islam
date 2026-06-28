// src/components/PrivateChatWindow.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Trash2, Flag, Ban, Smile, ImagePlus, Mic } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import VideoCallButton from "./VideoCallButton";
import MessageAttachment from "./MessageAttachment";
import { VoiceMessageRecorder } from "./VoiceMessageRecorder";
import { uploadVoiceMessage, recordVoiceAttachment } from "@/utils/voiceMessageUpload";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Conversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

type MsgRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
  is_deleted: boolean | null;
  read_by: any;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readByIncludes(read_by: any, userId: string) {
  if (!read_by) return false;
  if (Array.isArray(read_by)) return read_by.includes(userId);
  if (typeof read_by === "object") return Boolean(read_by[userId]);
  return false;
}

function mergeReadBy(read_by: any, userId: string) {
  if (!read_by) return { [userId]: true };
  if (Array.isArray(read_by)) {
    if (read_by.includes(userId)) return read_by;
    return [...read_by, userId];
  }
  if (typeof read_by === "object") return { ...read_by, [userId]: true };
  return { [userId]: true };
}

function normalizeContent(raw: string | null) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "photo") return "Photo";
  if (UUID_RE.test(s)) return "Attachment";
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    return "Attachment";
  }
  return s;
}

function fmtTime(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function withTimeout<T>(
  p: PromiseLike<T>,
  ms = 15000,
  label = "timeout"
): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

function maybeAbortSignal(q: any, signal: AbortSignal) {
  if (q && typeof q.abortSignal === "function") return q.abortSignal(signal);
  return q;
}

function isAbortLike(e: any) {
  const name = String(e?.name || "");
  const msg = String(e?.message || "");
  return (
    name === "AbortError" ||
    msg.includes("signal is aborted") ||
    msg.toLowerCase().includes("aborted")
  );
}

export default function PrivateChatWindow(props: {
  conversation: Conversation;
  onUpdateConversation?: (updated: Conversation) => void;
}) {
  const { conversation, onUpdateConversation } = props;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const userId = user?.id ?? "";
  const otherId = conversation.otherUserId;
  const convoKey = `${userId}:${otherId}`;

  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [messageAttachments, setMessageAttachments] = useState<Record<string, any[]>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [userBlocked, setUserBlocked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const loadSeqRef = useRef(0);

  const title = useMemo(
    () => conversation.otherUserName || "Chat",
    [conversation.otherUserName]
  );

  const updateConversationFromMessages = useCallback(
    (rows: MsgRow[]) => {
      if (!onUpdateConversation) return;
      const last = rows[rows.length - 1];

      onUpdateConversation({
        ...conversation,
        lastMessage: last ? normalizeContent(last.content) : "",
        lastMessageAt: last ? last.created_at : undefined,
        unreadCount: 0,
      });
    },
    [conversation, onUpdateConversation]
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

const load = useCallback(
  async (signal: AbortSignal) => {
    if (!userId || !otherId) return;

    const nowIso = new Date().toISOString();

      const mySeq = ++loadSeqRef.current;

      if (aliveRef.current) {
        setLoading(true);
        setErrorText(null);
      }

      try {
     const baseSelect =
       "id, sender_id, recipient_id, content, created_at, is_deleted, read_by, hidden_after";

        const sentQ = maybeAbortSignal(
          supabase
       .from("messages")
       .select(baseSelect)
       .eq("sender_id", userId)
       .eq("recipient_id", otherId)
       .neq("is_deleted", true as any)
       .or(`hidden_after.is.null,hidden_after.gt.${nowIso}`)
       .order("created_at", { ascending: true })
       .limit(500),
          signal
        );

        const recvQ = maybeAbortSignal(
          supabase
            .from("messages")
            .select(baseSelect)
            .eq("sender_id", otherId)
            .eq("recipient_id", userId)
            .neq("is_deleted", true as any)
            .or(`hidden_after.is.null,hidden_after.gt.${nowIso}`)
            .order("created_at", { ascending: true })
            .limit(500),
          signal
        );

        const [{ data: sent, error: sentErr }, { data: recv, error: recvErr }] =
          await withTimeout(Promise.all([sentQ, recvQ]), 15000, "messages query timeout");

        if (!aliveRef.current || mySeq !== loadSeqRef.current) return;
        if (sentErr) throw sentErr;
        if (recvErr) throw recvErr;

        const merged = ([...(sent || []), ...(recv || [])] as MsgRow[])
          .filter((m) => m.is_deleted !== true)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

        setMessages(merged);

        const messageIds = merged.map((m) => m.id);

        if (messageIds.length > 0) {
          const { data: attachments, error: attachmentError } = await supabase
            .from("message_attachments")
            .select("*")
            .in("message_id", messageIds);

          if (attachmentError) {
            console.error("[PrivateChatWindow] attachment load failed:", attachmentError);
          } else {
            const grouped: Record<string, any[]> = {};

            (attachments || []).forEach((attachment: any) => {
              if (!grouped[attachment.message_id]) {
                grouped[attachment.message_id] = [];
              }
              grouped[attachment.message_id].push(attachment);
            });

            setMessageAttachments(grouped);
          }
        } else {
          setMessageAttachments({});
        }

        updateConversationFromMessages(merged);

        const unreadIncoming = merged.filter(
          (m) => m.recipient_id === userId && !readByIncludes(m.read_by, userId)
        );

        if (unreadIncoming.length) {
          void Promise.all(
            unreadIncoming.slice(0, 50).map((m) =>
              supabase
                .from("messages")
                .update({ read_by: mergeReadBy(m.read_by, userId) })
                .eq("id", m.id)
                .eq("recipient_id", userId)
            )
          );
        }
      } catch (e: any) {
        if (signal.aborted || isAbortLike(e)) return;
        if (!aliveRef.current || mySeq !== loadSeqRef.current) return;

        console.error("[PrivateChatWindow] load failed:", e);
        setMessages([]);
        setErrorText(e?.message || "Failed to load messages");
      } finally {
        if (!signal.aborted && aliveRef.current && mySeq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [userId, otherId, updateConversationFromMessages]
  );

  const retry = useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
  }, [load]);

  useEffect(() => {
    if (!userId || !otherId) return;

    const controller = new AbortController();
    void load(controller.signal);

    return () => controller.abort();
  }, [convoKey, load, userId, otherId]);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      loadSeqRef.current++;
    };
  }, []);

  useEffect(() => {
    if (!userId || !otherId) return;

    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const ch = supabase
        .channel(`dm-room-${[userId, otherId].sort().join("-")}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as MsgRow;
            if (!row) return;

            const isMine = row.sender_id === userId && row.recipient_id === otherId;
            const isTheirs = row.sender_id === otherId && row.recipient_id === userId;

            if (!isMine && !isTheirs) return;
            if (row.is_deleted === true) return;
            if (row.hidden_after && new Date(row.hidden_after).getTime() <= Date.now()) return;
            if (userBlocked && row.sender_id === otherId) return;

            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;

              const next = [...prev, row].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );

              updateConversationFromMessages(next);
              return next;
            });

            if (row.recipient_id === userId && !readByIncludes(row.read_by, userId)) {
              void supabase
                .from("messages")
                .update({ read_by: mergeReadBy(row.read_by, userId) })
                .eq("id", row.id)
                .eq("recipient_id", userId);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as MsgRow;
            if (!row) return;

            const isMine = row.sender_id === userId && row.recipient_id === otherId;
            const isTheirs = row.sender_id === otherId && row.recipient_id === userId;

            if (!isMine && !isTheirs) return;

            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === row.id);
              if (idx === -1) return prev;

              let next: MsgRow[];

              if (row.is_deleted === true || (userBlocked && row.sender_id === otherId)) {
                next = prev.filter((m) => m.id !== row.id);
              } else {
                next = prev.slice();
                next[idx] = row;
                next.sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
              }

              updateConversationFromMessages(next);
              return next;
            });
          }
        )
        .on("broadcast", { event: "typing" }, (payload) => {
          const data = payload.payload as any;

          if (data.sender_id !== otherId || data.recipient_id !== userId) return;

          setOtherTyping(true);

          if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
          }

          typingTimeoutRef.current = window.setTimeout(() => {
            setOtherTyping(false);
          }, 2500);
        });

     ch.subscribe((status) => {
       console.log("[PrivateChatWindow] channel status:", status);
     });
      channelRef.current = ch;
} catch (e: any) {
  console.error("[PrivateChatWindow] send failed:", e);
  setErrorText(e?.message || e?.details || e?.hint || "Failed to send message");
}

    return () => {
      try {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, [convoKey, userId, otherId, updateConversationFromMessages, userBlocked]);

  const reportUser = async () => {
    if (!userId || !otherId || reporting) return;

    const reason = window.prompt(
      "Report user\n\nEnter a reason:\nExample: harassment, spam, hate, explicit content",
      "harassment"
    );

    if (reason == null) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      toast({
        title: "Report not submitted",
        description: "Please provide a reason.",
        variant: "destructive",
      });
      return;
    }

    const details = window.prompt("Optional details", "") ?? "";

    setReporting(true);

    try {
      const { error } = await withTimeout(
        supabase.from("reports").insert({
          reported_by: userId,
          reported_user_id: otherId,
          message_id: null,
          reason: trimmedReason,
          details: details.trim() || null,
        }),
        15000,
        "report timeout"
      );

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: `${conversation.otherUserName} has been reported for review.`,
      });
    } catch (e: any) {
      console.error("[PrivateChatWindow] report failed:", e);
      toast({
        title: "Failed to submit report",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setReporting(false);
    }
  };

  const blockUser = async () => {
    if (!userId || !otherId || blocking) return;

    const ok = window.confirm(
      `Block ${conversation.otherUserName}?\n\nTheir messages will be removed from this chat immediately and they will be reported for review.`
    );

    if (!ok) return;

    setBlocking(true);

    try {
      const { error: blockError } = await withTimeout(
        supabase.from("blocked_users").insert({
          blocker_id: userId,
          blocked_id: otherId,
        }),
        15000,
        "block timeout"
      );

      const blockMsg = String(blockError?.message || "").toLowerCase();

      if (blockError && !blockMsg.includes("duplicate")) throw blockError;

      const { error: reportError } = await withTimeout(
        supabase.from("reports").insert({
          reported_by: userId,
          reported_user_id: otherId,
          message_id: null,
          reason: "Blocked abusive user",
          details: "User was blocked from private chat safety controls.",
        }),
        15000,
        "block report timeout"
      );

      if (reportError) {
        console.log("[PrivateChatWindow] block report failed:", reportError);
      }

      setUserBlocked(true);

      setMessages((prev) => {
        const next = prev.filter((m) => m.sender_id !== otherId);
        updateConversationFromMessages(next);
        return next;
      });

      toast({
        title: "User blocked",
        description: `${conversation.otherUserName} has been blocked and their content was removed from this chat.`,
      });
    } catch (e: any) {
      console.error("[PrivateChatWindow] block failed:", e);
      toast({
        title: "Failed to block user",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  };

  const editMessage = async (msg: MsgRow) => {
    const current = (msg.content || "").trim();
    const next = window.prompt("Edit message", current);

    if (next == null) return;

    const trimmed = next.trim();

    if (!trimmed) return;

    try {
      const { error } = await withTimeout(
        supabase
          .from("messages")
          .update({ content: trimmed })
          .eq("id", msg.id)
          .eq("sender_id", userId),
        15000,
        "edit timeout"
      );

      if (error) throw error;

      setMessages((prev) => {
        const nextRows = prev.map((m) =>
          m.id === msg.id ? { ...m, content: trimmed } : m
        );
        updateConversationFromMessages(nextRows);
        return nextRows;
      });
    } catch (e) {
      console.error("[PrivateChatWindow] edit failed:", e);
      setErrorText("Failed to edit message");
    }
  };

  const deleteMessage = async (msg: MsgRow) => {
    const ok = window.confirm("Delete this message?");

    if (!ok) return;

    try {
      const { error } = await withTimeout(
        supabase
          .from("messages")
          .update({ is_deleted: true })
          .eq("id", msg.id)
          .eq("sender_id", userId),
        15000,
        "delete timeout"
      );

      if (error) throw error;

      setMessages((prev) => {
        const nextRows = prev.filter((m) => m.id !== msg.id);
        updateConversationFromMessages(nextRows);
        return nextRows;
      });
    } catch (e) {
      console.error("[PrivateChatWindow] delete failed:", e);
      setErrorText("Failed to delete message");
    }
  };

  const send = async () => {
    const body = text.trim();

    if (!body || !userId || !otherId || userBlocked) return;

    setSending(true);

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("messages")
       .insert({
         sender_id: userId,
         recipient_id: otherId,
         content: body,
         hidden_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
       })
          .select("id, sender_id, recipient_id, content, created_at, is_deleted, read_by")
          .single(),
        15000,
        "send timeout"
      );

      if (error) throw error;

      setText("");

      const row = data as MsgRow;

      if (row) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;

          const next = [...prev, row].sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          updateConversationFromMessages(next);
          return next;
        });
      }
    } catch (e) {
      console.error("[PrivateChatWindow] send failed:", e);
      setErrorText("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handlePrivateMediaSelect = async (file: File) => {
    if (!userId || !otherId) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrorText("Please select an image or video.");
      return;
    }

    const fileExt = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(filePath);

      const { data: msg, error: msgError } = await supabase
        .from("messages")
  .insert({
    sender_id: userId,
    recipient_id: otherId,
    content: isVideo ? "Video" : "Photo",
    message_type: isVideo ? "video" : "image",
    hidden_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })
        .select("id, sender_id, recipient_id, content, created_at, is_deleted, read_by")
        .single();

      if (msgError) throw msgError;

      const { error: attachError } = await supabase.from("message_attachments").insert({
        message_id: msg.id,
        file_type: isVideo ? "video" : "image",
        file_url: data.publicUrl,
        thumbnail_url: null,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: userId,
        metadata: {
          mimeType: file.type,
          kind: isVideo ? "video" : "image",
        },
      });

      if (attachError) throw attachError;

      setMessageAttachments((prev) => ({
        ...prev,
        [msg.id]: [
          ...(prev[msg.id] || []),
          {
            id: crypto.randomUUID(),
            message_id: msg.id,
            file_type: isVideo ? "video" : "image",
            file_url: data.publicUrl,
            thumbnail_url: null,
            file_name: file.name,
            file_size: file.size,
            uploaded_by: userId,
            metadata: {
              mimeType: file.type,
              kind: isVideo ? "video" : "image",
            },
          },
        ],
      }));

      setMessages((prev) => [...prev, msg as MsgRow]);
    } catch (error: any) {
      console.error("Private media upload failed:", error);
      setErrorText(error?.message || "Failed to send media.");
    }
  };

  const handleVoiceMessageSend = async (
    audioBlob: Blob,
    duration: number,
    mimeType: string
  ) => {
    if (!userId || !otherId) return;

    try {
      const { data: msg, error: msgError } = await supabase
        .from("messages")
   .insert({
     sender_id: userId,
     recipient_id: otherId,
     content: "🎤 Voice message",
     message_type: "voice",
     hidden_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
   })
        .select("id, sender_id, recipient_id, content, created_at, is_deleted, read_by")
        .single();

      if (msgError) throw msgError;

      const filePath = await uploadVoiceMessage(audioBlob, msg.id, userId, mimeType);

      await recordVoiceAttachment(
        msg.id,
        filePath,
        mimeType,
        audioBlob.size,
        userId
      );

      const { data } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(filePath);

      setMessageAttachments((prev) => ({
        ...prev,
        [msg.id]: [
          ...(prev[msg.id] || []),
          {
            id: crypto.randomUUID(),
            message_id: msg.id,
            file_type: "voice",
            file_url: data.publicUrl,
            file_name: `voice-${Date.now()}`,
            file_size: audioBlob.size,
            uploaded_by: userId,
            metadata: {
              duration,
              mimeType,
              kind: "voice",
            },
          },
        ],
      }));

      setMessages((prev) => [...prev, msg as MsgRow]);
    } catch (error: any) {
      console.error("Voice message failed:", error);
      setErrorText(error?.message || "Failed to send voice message.");
    }
  };

  const sendTypingSignal = () => {
    if (!channelRef.current || !userId || !otherId) return;

    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        sender_id: userId,
        recipient_id: otherId,
      },
    });
  };

return (
  <div
    className="flex flex-col bg-background h-[100dvh] overflow-hidden"
    style={{
      paddingTop: "env(safe-area-inset-top)",
    }}
  >

      <div className="flex items-center justify-between px-3 py-2 border-b bg-background z-30 min-h-[50px] shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="shrink-0 text-xl leading-none text-foreground !bg-transparent !border-0 !shadow-none !outline-none p-0 m-0"
            aria-label="Back to messages"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => {
              if (!otherId) return;
              navigate(`/profile/${otherId}`);
            }}
            className="text-sm font-semibold truncate text-left hover:underline min-w-0"
          >
            {title}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <VideoCallButton
            calleeId={otherId}
            calleeName={conversation.otherUserName}
            conversationId={conversation.id}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/90 hover:bg-muted"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => void reportUser()}
          disabled={reporting}
        >
          <Flag className="h-4 w-4 mr-2" />
          {reporting ? "Reporting..." : "Report user"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => void blockUser()}
          disabled={blocking}
          className="text-destructive"
        >
          <Ban className="h-4 w-4 mr-2" />
          {blocking ? "Blocking..." : "Block user"}
        </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={listRef}
  className="flex-1 min-h-0 overflow-y-auto px-2 pt-1 pb-28"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {userBlocked ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            You blocked this user. Their content has been removed from this chat.
          </div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : errorText ? (
          <div className="text-sm text-destructive">
            {errorText}
            <div className="mt-2">
              <Button variant="outline" onClick={retry}>
                Retry
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            const txt = normalizeContent(m.content);

            if (!txt) return null;

            const attachments = messageAttachments[m.id] || [];
            const hasAttachment = attachments.length > 0;

            const isOnlyMedia =
              hasAttachment &&
              (txt === "Photo" || txt === "Video" || txt === "🎤 Voice message");

            const bubbleClass = hasAttachment
              ? "max-w-[82%] rounded-2xl p-0 bg-transparent shadow-none"
              : mine
              ? "max-w-[82%] rounded-2xl px-3 py-2 bg-green-600 text-white rounded-br-md"
              : "max-w-[82%] rounded-2xl px-3 py-2 bg-card border rounded-bl-md";

            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={bubbleClass}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {!isOnlyMedia && (
                        <div className="whitespace-pre-wrap break-words">{txt}</div>
                      )}

                      {attachments.map((attachment) => (
                        <MessageAttachment
                          key={attachment.id}
                          attachment={attachment}
                        />
                      ))}

                      <div
                        className={`mt-1 flex items-center gap-1 text-[11px] ${
                          mine
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span>{fmtTime(m.created_at)}</span>

                        {mine && (
                          <span
                            title={readByIncludes(m.read_by, otherId) ? "Read" : "Sent"}
                          >
                            {readByIncludes(m.read_by, otherId) ? "✓✓ Read" : "✓ Sent"}
                          </span>
                        )}
                      </div>
                    </div>

                    {mine && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded-md text-primary-foreground/80"
                            aria-label="Message actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void editMessage(m)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => void deleteMessage(m)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {otherTyping && (
        <div className="sticky bottom-[72px] z-[99998] px-3 text-xs text-muted-foreground">
          {conversation.otherUserName} is typing...
        </div>
      )}

<div className="sticky bottom-0 z-50 flex w-full items-center gap-1.5 border-t bg-background px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          id="private-chat-media-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            void handlePrivateMediaSelect(file);
            e.target.value = "";
          }}
        />

        <div className="flex w-full gap-1.5 items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full p-0"
            onClick={() => setText((prev) => `${prev}🙂`)}
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full p-0"
            onClick={() => setShowVoiceRecorder(true)}
          >
            <Mic className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full p-0"
            onClick={() =>
              document.getElementById("private-chat-media-input")?.click()
            }
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>

          <textarea
            className="flex-1 min-h-[34px] max-h-[80px] resize-none rounded-xl border bg-background px-2 py-1.5 text-[13px] outline-none disabled:opacity-60"
            placeholder={userBlocked ? "You blocked this user" : "Message..."}
            value={text}
            disabled={userBlocked}
            onChange={(e) => {
              setText(e.target.value);
              sendTypingSignal();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending) void send();
              }
            }}
          />

          <Button
            className="rounded-xl h-[34px] px-3 text-xs"
            onClick={() => void send()}
            disabled={sending || !text.trim() || userBlocked}
          >
            {sending ? "..." : "Send"}
          </Button>
        </div>
      </div>

      {showVoiceRecorder && (
        <VoiceMessageRecorder
          onCancel={() => setShowVoiceRecorder(false)}
          onSend={async (audioBlob, duration, mimeType) => {
            await handleVoiceMessageSend(audioBlob, duration, mimeType);
            setShowVoiceRecorder(false);
          }}
        />
      )}
    </div>
  );
}