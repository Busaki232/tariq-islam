// src/components/PrivateChatWindow.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ShareHadithDialog, type HadithData } from "./ShareHadithDialog";

import {
  ArrowLeft,
  Ban,
  Copy,
  BookOpen,
  Flag,
  ImagePlus,
  Info,
  Languages,
  Loader2,
  Mic,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import VideoCallButton from "./VideoCallButton";
import MessageAttachment from "./MessageAttachment";
import { MessageReactions } from "./MessageReactions";
import { VoiceMessageRecorder } from "./VoiceMessageRecorder";
import {
  uploadVoiceMessage,
  recordVoiceAttachment,
} from "@/utils/voiceMessageUpload";

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
  deleted_for: string[] | null;
  read_by: any;
  reactions: Record<string, string[]> | null;
};

type MessageTranslation = {
  translatedText: string;
  detectedLanguageName: string;
  targetLanguageName: string;
  alreadyTargetLanguage: boolean;
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
  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
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
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms)
    ),
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
  const { i18n } = useTranslation();

  const userId = user?.id ?? "";
  const otherId = conversation.otherUserId;
  const convoKey = `${userId}:${otherId}`;

  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [messageAttachments, setMessageAttachments] = useState<
    Record<string, any[]>
  >({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [userBlocked, setUserBlocked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const [messageTranslations, setMessageTranslations] = useState<
    Record<string, MessageTranslation>
  >({});
  const [translatingMessageIds, setTranslatingMessageIds] = useState<string[]>(
    []
  );
  const [showingTranslatedMessageIds, setShowingTranslatedMessageIds] =
    useState<string[]>([]);

  const [selectedMessage, setSelectedMessage] = useState<MsgRow | null>(null);

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
          "id, sender_id, recipient_id, content, created_at, is_deleted, deleted_for, read_by, reactions, hidden_after";

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
          await withTimeout(
            Promise.all([sentQ, recvQ]),
            15000,
            "messages query timeout"
          );

        if (!aliveRef.current || mySeq !== loadSeqRef.current) return;
        if (sentErr) throw sentErr;
        if (recvErr) throw recvErr;

        const merged = ([...(sent || []), ...(recv || [])] as MsgRow[])
          .filter(
            (m) => m.is_deleted !== true && !m.deleted_for?.includes(userId)
          )
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );

        setMessages(merged);

        const messageIds = merged.map((m) => m.id);

        if (messageIds.length > 0) {
          const { data: attachments, error: attachmentError } = await supabase
            .from("message_attachments")
            .select("*")
            .in("message_id", messageIds);

          if (attachmentError) {
            console.error(
              "[PrivateChatWindow] attachment load failed:",
              attachmentError
            );
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
        if (
          !signal.aborted &&
          aliveRef.current &&
          mySeq === loadSeqRef.current
        ) {
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

            const isMine =
              row.sender_id === userId && row.recipient_id === otherId;
            const isTheirs =
              row.sender_id === otherId && row.recipient_id === userId;

            if (!isMine && !isTheirs) return;
            if (row.is_deleted === true) return;
            if (row.deleted_for?.includes(userId)) return;
            if (
              row.hidden_after &&
              new Date(row.hidden_after).getTime() <= Date.now()
            )
              return;
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

            if (
              row.recipient_id === userId &&
              !readByIncludes(row.read_by, userId)
            ) {
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

            const isMine =
              row.sender_id === userId && row.recipient_id === otherId;
            const isTheirs =
              row.sender_id === otherId && row.recipient_id === userId;

            if (!isMine && !isTheirs) return;

            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === row.id);
              if (idx === -1) return prev;

              let next: MsgRow[];

              if (
                row.is_deleted === true ||
                row.deleted_for?.includes(userId) ||
                (userBlocked && row.sender_id === otherId)
              ) {
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

          if (data.sender_id !== otherId || data.recipient_id !== userId)
            return;

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
      setErrorText(
        e?.message || e?.details || e?.hint || "Failed to send message"
      );
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

  const deleteMessageForMe = async (msg: MsgRow) => {
    const ok = window.confirm("Delete this message from your chat?");

    if (!ok) return;

    try {
      const { error } = await withTimeout(
        (supabase.rpc as any)("delete_private_message_for_me", {
          p_message_id: msg.id,
        }),
        15000,
        "delete for me timeout"
      );

      if (error) throw error;

      setSelectedMessage(null);

      setMessages((prev) => {
        const nextRows = prev.filter((message) => message.id !== msg.id);

        updateConversationFromMessages(nextRows);
        return nextRows;
      });
    } catch (error) {
      console.error("[PrivateChatWindow] delete for me failed:", error);

      toast({
        title: "Unable to delete message",
        description: "The message could not be removed from your chat.",
        variant: "destructive",
      });
    }
  };

  const deleteMessageForEveryone = async (msg: MsgRow) => {
    if (msg.sender_id !== userId) return;

    const ok = window.confirm("Delete this message for both people?");

    if (!ok) return;

    try {
      const { error } = await withTimeout(
        (supabase.rpc as any)("delete_private_message_for_everyone", {
          p_message_id: msg.id,
        }),
        15000,
        "delete for everyone timeout"
      );

      if (error) throw error;

      setSelectedMessage(null);

      setMessages((prev) => {
        const nextRows = prev.filter((message) => message.id !== msg.id);

        updateConversationFromMessages(nextRows);
        return nextRows;
      });
    } catch (error) {
      console.error("[PrivateChatWindow] delete for everyone failed:", error);

      toast({
        title: "Unable to recall message",
        description: "The message could not be deleted for everyone.",
        variant: "destructive",
      });
    }
  };

  const refreshMessageReactions = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      if (error) throw error;

      const reactions =
        data?.reactions && typeof data.reactions === "object"
          ? (data.reactions as Record<string, string[]>)
          : {};

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, reactions } : message
        )
      );
    } catch (error) {
      console.error("[PrivateChatWindow] failed to refresh reactions:", error);
    }
  };

  const handleQuickReaction = async (message: MsgRow, emoji: string) => {
    if (!userId) return;

    try {
      const currentReactions: Record<string, string[]> = {
        ...(message.reactions || {}),
      };

      // Remove this user's existing reaction from every emoji.
      Object.keys(currentReactions).forEach((reactionEmoji) => {
        currentReactions[reactionEmoji] = currentReactions[
          reactionEmoji
        ].filter((reactionUserId) => reactionUserId !== userId);

        if (currentReactions[reactionEmoji].length === 0) {
          delete currentReactions[reactionEmoji];
        }
      });

      const selectedUsers = message.reactions?.[emoji] || [];
      const wasAlreadySelected = selectedUsers.includes(userId);

      // Tapping the currently selected reaction removes it.
      // Tapping another emoji changes the user's reaction.
      if (!wasAlreadySelected) {
        currentReactions[emoji] = [...(currentReactions[emoji] || []), userId];
      }

      const { error } = await supabase
        .from("messages")
        .update({ reactions: currentReactions })
        .eq("id", message.id);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? {
                ...item,
                reactions: currentReactions,
              }
            : item
        )
      );

      setSelectedMessage(null);
    } catch (error) {
      console.error("[PrivateChatWindow] quick reaction failed:", error);

      toast({
        title: "Reaction failed",
        description: "The reaction could not be saved.",
        variant: "destructive",
      });
    }
  };

  const translateMessage = async (msg: MsgRow) => {
    const existing = messageTranslations[msg.id];

    if (existing) {
      setShowingTranslatedMessageIds((current) =>
        current.includes(msg.id)
          ? current.filter((id) => id !== msg.id)
          : [...current, msg.id]
      );
      return;
    }

    if (translatingMessageIds.includes(msg.id)) {
      return;
    }

    const activeLanguage = i18n.resolvedLanguage || i18n.language || "en";

    const requestedLanguage = activeLanguage.split("-")[0].toLowerCase();

    const supportedCodes = ["en", "ar", "fr", "ha", "yo", "ur"];

    const targetLanguageCode = supportedCodes.includes(requestedLanguage)
      ? requestedLanguage
      : "en";

    try {
      setTranslatingMessageIds((current) => [...current, msg.id]);

      const { data, error } = await supabase.functions.invoke(
        "translate-message",
        {
          body: {
            messageId: msg.id,
            targetLanguageCode,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.translatedText || typeof data.translatedText !== "string") {
        throw new Error("The translation response was invalid.");
      }

      setMessageTranslations((current) => ({
        ...current,
        [msg.id]: {
          translatedText: data.translatedText,
          detectedLanguageName:
            data.detectedLanguageName || "Detected language",
          targetLanguageName:
            data.targetLanguageName || targetLanguageCode.toUpperCase(),
          alreadyTargetLanguage: Boolean(data.alreadyTargetLanguage),
        },
      }));

      setShowingTranslatedMessageIds((current) =>
        current.includes(msg.id) ? current : [...current, msg.id]
      );
    } catch (error) {
      console.error("Unable to translate message:", error);

      toast({
        title: "Unable to translate message",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTranslatingMessageIds((current) =>
        current.filter((id) => id !== msg.id)
      );
    }
  };

  const copyMessage = async (msg: MsgRow) => {
    const content = normalizeContent(msg.content);

    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);

      toast({
        title: "Message copied",
        description: "The message was copied to your clipboard.",
      });

      setSelectedMessage(null);
    } catch (error) {
      console.error("[PrivateChatWindow] copy failed:", error);

      toast({
        title: "Unable to copy",
        description: "The message could not be copied.",
        variant: "destructive",
      });
    }
  };

  const showMessageInfo = (msg: MsgRow) => {
    const sentAt = new Date(msg.created_at).toLocaleString();

    const status =
      msg.sender_id === userId
        ? readByIncludes(msg.read_by, otherId)
          ? "Read"
          : "Sent"
        : "Received";

    window.alert(`Message information\n\nSent: ${sentAt}\nStatus: ${status}`);
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
            hidden_after: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .select(
            "id, sender_id, recipient_id, content, created_at, is_deleted, read_by"
          )
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
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
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
          hidden_after: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select(
          "id, sender_id, recipient_id, content, created_at, is_deleted, read_by"
        )
        .single();

      if (msgError) throw msgError;

      const { error: attachError } = await supabase
        .from("message_attachments")
        .insert({
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
          hidden_after: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select(
          "id, sender_id, recipient_id, content, created_at, is_deleted, read_by, reactions"
        )
        .single();

      if (msgError) throw msgError;

      const filePath = await uploadVoiceMessage(
        audioBlob,
        msg.id,
        userId,
        mimeType
      );

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

  const handleShareHadith = async (hadith: HadithData) => {
    if (!userId || !otherId || userBlocked) return;

    const body = [
      hadith.arabicText,
      hadith.englishText,
      "",
      `${hadith.book} · ${hadith.reference}`,
      hadith.grade ? `Grade: ${hadith.grade}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    setSending(true);

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("messages")
          .insert({
            sender_id: userId,
            recipient_id: otherId,
            content: body,
            hidden_after: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .select(
            "id, sender_id, recipient_id, content, created_at, is_deleted, read_by, reactions"
          )
          .single(),
        15000,
        "hadith send timeout"
      );

      if (error) throw error;

      const row = data as MsgRow;

      setMessages((current) => {
        if (current.some((message) => message.id === row.id)) {
          return current;
        }

        const next = [...current, row].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        updateConversationFromMessages(next);
        return next;
      });
    } catch (error) {
      console.error("[PrivateChatWindow] hadith send failed:", error);

      toast({
        title: "Unable to share hadith",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
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
      className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-background md:h-[100dvh]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="z-30 flex min-h-[68px] shrink-0 items-center justify-between border-b bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!otherId) return;
              navigate(`/profile/${otherId}`);
            }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
          >
            <Avatar className="h-11 w-11 shrink-0 border">
              <AvatarImage
                src={conversation.otherUserAvatar || ""}
                alt={title}
              />

              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {title.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {title}
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {otherTyping ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="font-medium text-primary">Typing...</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    <span>Private conversation</span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
          <VideoCallButton
            calleeId={otherId}
            calleeName={conversation.otherUserName}
            conversationId={conversation.id}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
                aria-label="Conversation options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void reportUser()}
                disabled={reporting}
              >
                <Flag className="mr-2 h-4 w-4" />
                {reporting ? "Reporting..." : "Report user"}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => void blockUser()}
                disabled={blocking}
                className="text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                {blocking ? "Blocking..." : "Block user"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto bg-muted/20 px-3 py-4 pb-28"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {userBlocked ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            You blocked this user. Their content has been removed from this
            chat.
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
            const translation = messageTranslations[m.id];
            const showingTranslation =
              !mine && showingTranslatedMessageIds.includes(m.id);
            const isTranslating = translatingMessageIds.includes(m.id);

            if (!txt) return null;

            const attachments = messageAttachments[m.id] || [];
            const hasAttachment = attachments.length > 0;

            const isOnlyMedia =
              hasAttachment &&
              (txt === "Photo" ||
                txt === "Video" ||
                txt === "🎤 Voice message");

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
                        <>
                          <div className="whitespace-pre-wrap break-words">
                            {showingTranslation && translation
                              ? translation.translatedText
                              : txt}
                          </div>

                          <button
                            type="button"
                            disabled={mine || isTranslating}
                            onClick={() => void translateMessage(m)}
                            className={
                              mine
                                ? "hidden"
                                : "mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            }
                          >
                            {isTranslating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Languages className="h-3 w-3" />
                            )}

                            {isTranslating
                              ? "Translating..."
                              : showingTranslation && translation
                              ? "See original"
                              : translation
                              ? "See translation"
                              : "Translate"}
                          </button>

                          {showingTranslation && translation && (
                            <p
                              className={`mt-1 text-[10px] ${
                                mine ? "text-white/65" : "text-muted-foreground"
                              }`}
                            >
                              {translation.alreadyTargetLanguage
                                ? `Already in ${translation.targetLanguageName}`
                                : `${translation.detectedLanguageName} → ${translation.targetLanguageName}`}
                            </p>
                          )}
                        </>
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
                            title={
                              readByIncludes(m.read_by, otherId)
                                ? "Read"
                                : "Sent"
                            }
                          >
                            {readByIncludes(m.read_by, otherId)
                              ? "✓✓ Read"
                              : "✓ Sent"}
                          </span>
                        )}
                      </div>

                      <div className={`mt-1 ${mine ? "flex justify-end" : ""}`}>
                        <MessageReactions
                          messageId={m.id}
                          reactions={m.reactions || {}}
                          onReactionUpdate={() =>
                            void refreshMessageReactions(m.id)
                          }
                          showPicker={false}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedMessage(m)}
                      className={`rounded-full p-1 transition ${
                        mine
                          ? "text-white/80 hover:bg-white/15"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      aria-label="Open message actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedMessage && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40 px-3 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] sm:items-center sm:justify-center sm:pb-3"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-semibold">Message actions</p>
                <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                  {normalizeContent(selectedMessage.content)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                aria-label="Close message actions"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b px-3 py-3">
              <div className="flex items-center justify-between gap-1 rounded-2xl bg-muted/60 p-2">
                {["❤️", "👍", "🤲", "😊", "😢", "🔥"].map((emoji) => {
                  const selected =
                    selectedMessage.reactions?.[emoji]?.includes(userId) ||
                    false;

                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        void handleQuickReaction(selectedMessage, emoji)
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition active:scale-90 ${
                        selected
                          ? "bg-green-600 shadow-sm ring-2 ring-green-600/30"
                          : "hover:bg-background"
                      }`}
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={() => void copyMessage(selectedMessage)}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-islamic-green/10 text-islamic-green">
                  <Copy className="h-5 w-5" />
                </span>

                <span className="font-medium">Copy</span>
              </button>

              <button
                type="button"
                onClick={() => showMessageInfo(selectedMessage)}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-islamic-green/10 text-islamic-green">
                  <Info className="h-5 w-5" />
                </span>

                <span className="font-medium">Info</span>
              </button>

              <button
                type="button"
                onClick={() => void deleteMessageForMe(selectedMessage)}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                  <Trash2 className="h-5 w-5" />
                </span>

                <span className="font-medium">Delete for me</span>
              </button>

              {selectedMessage.sender_id === userId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const message = selectedMessage;
                      setSelectedMessage(null);
                      void editMessage(message);
                    }}
                    className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-islamic-green/10 text-islamic-green">
                      <Pencil className="h-5 w-5" />
                    </span>

                    <span className="font-medium">Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void deleteMessageForEveryone(selectedMessage)
                    }
                    className="col-span-2 flex items-center gap-3 rounded-2xl border border-destructive/30 p-4 text-left text-destructive transition hover:bg-destructive/5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                      <Trash2 className="h-5 w-5" />
                    </span>

                    <span className="font-medium">Delete for everyone</span>
                  </button>
                </>
              )}
            </div>

            <div className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
              Tariq Islam private messaging
            </div>
          </div>
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
          <ShareHadithDialog
            onShare={(hadith) => {
              void handleShareHadith(hadith);
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full p-0"
                disabled={userBlocked || sending}
                aria-label="Share Hadith"
                title="Share Hadith"
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            }
          />

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
