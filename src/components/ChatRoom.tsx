// src/components/ChatRoom.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  Mic,
  FileText,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import { VoiceMessageRecorder } from "./VoiceMessageRecorder";
import { uploadVoiceMessage, recordVoiceAttachment } from "@/utils/voiceMessageUpload";
import { MessageStatus } from "./MessageStatus";
import { ImageUpload } from "./ImageUpload";
import { MessageAttachment } from "./MessageAttachment";
import { MessageReactions } from "./MessageReactions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { HeroButton } from "@/components/ui/hero-button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/hooks/useAuth";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useUserPresence } from "@/hooks/useUserPresence";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ChatComposer from "@/components/chat/ChatComposer";

interface Message {
  id: string;
  user: string;
  message: string;
  time: string;
  location: string;
  likes: number;
  isOwn?: boolean;
  edited_at?: string;
  is_deleted?: boolean;
  sender_id?: string;
  status?: "sending" | "sent" | "delivered" | "read";
  reactions?: Record<string, string[]>;
  message_type?: string;
}

interface RealOnlineUser {
  user_id: string;
  name: string;
  location: string;
  status: "online" | "away";
  avatar_url?: string | null;
}

const COMMUNITY_MESSAGE_TYPE = "community_post";
const ATTACHMENTS_BUCKET = "message-attachments";

function isAbortError(err: any) {
  return (
    err?.name === "AbortError" ||
    String(err?.message || "").toLowerCase().includes("signal is aborted") ||
    String(err?.details || "").toLowerCase().includes("aborterror")
  );
}

function isTempPath(raw: string | null | undefined) {
  if (!raw) return false;
  const s = String(raw);
  return s.includes("/temp-") || s.includes("thumbs/temp-") || s.startsWith("temp-");
}

function toStoragePath(raw: string | null | undefined, bucket: string): string | null {
  if (!raw) return null;

  if (!raw.startsWith("http")) {
    const cleaned = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");
    if (!cleaned) return null;

    const prefix = `${bucket}/`;
    if (cleaned.startsWith(prefix)) return cleaned.slice(prefix.length) || null;

    return cleaned;
  }

  try {
    const u = new URL(raw);
    const marker = `/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;

    const key = u.pathname.slice(idx + marker.length);
    const cleaned = key.split("?")[0].split("#")[0].replace(/^\/+/, "");
    return cleaned || null;
  } catch {
    return null;
  }
}

function isObjectNotFound(err: any) {
  const msg = String(err?.message || err?.error || "");
  const status = err?.statusCode ?? err?.status ?? err?.cause?.status;
  return (
    msg.toLowerCase().includes("object not found") ||
    msg.toLowerCase().includes("not_found") ||
    status === 404
  );
}

const ChatRoom = () => {
  const { t } = useTranslation("chat");
  const { user } = useAuth();
  const navigate = useNavigate();

  const authed = !!user?.id;

  const { connectedUsers = [] } = useUserConnections();

  const visiblePresenceIds = useMemo(() => {
    return (connectedUsers || [])
      .map((u: any) => u.user_id)
      .filter(Boolean)
      .slice(0, 200);
  }, [connectedUsers]);

  const { presenceMap } = useUserPresence(visiblePresenceIds);

  const onlineUsers = useMemo<RealOnlineUser[]>(() => {
    return (connectedUsers || [])
      .map((u: any) => {
        const name = (u?.full_name || "").trim() || t("unknownUser", { defaultValue: "Unknown User" });
        const location =
          (u?.location || "").trim() || t("locationNotSet", { defaultValue: "Location not set" });
        const isOnline = !!presenceMap?.[u.user_id];

        return {
          user_id: u.user_id,
          name,
          location,
          status: isOnline ? "online" : "away",
          avatar_url: u?.avatar_url || "",
        };
      })
      .sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === "online" ? -1 : 1;
      });
  }, [connectedUsers, presenceMap, t]);

  const onlineCount = onlineUsers.filter((u) => u.status === "online").length;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Record<string, any[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  const missingKeysRef = useRef<Set<string>>(new Set());
  const signedUrlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  const profileCacheRef = useRef<Map<string, { full_name: string | null; location: string | null }>>(new Map());

  const getProfileCached = useCallback(async (userId: string) => {
    const cached = profileCacheRef.current.get(userId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, location")
      .eq("user_id", userId)
      .maybeSingle();

    const prof = error
      ? { full_name: null, location: null }
      : {
          full_name: (data as any)?.full_name ?? null,
          location: (data as any)?.location ?? null,
        };

    profileCacheRef.current.set(userId, prof);
    return prof;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!authed) return;
    scrollToBottom();
  }, [messages.length, authed, scrollToBottom]);

const getSignedUrlOrNull = useCallback(
  async (raw: string | null | undefined, expiresIn = 3600) => {
    if (!raw) return null;
    if (isTempPath(raw)) return null;

    // Already a playable full URL. Do not sign it again.
    if (raw.startsWith("http")) {
      return raw;
    }

    const key = toStoragePath(raw, ATTACHMENTS_BUCKET);
    if (!key) return null;

    if (missingKeysRef.current.has(key)) return null;

    const now = Date.now();
    const cached = signedUrlCacheRef.current.get(key);
    if (cached && cached.expiresAt > now + 10_000) return cached.url;

    try {
      const { data, error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(key, expiresIn);

if (error) {
  missingKeysRef.current.add(key);
  return null;
}

      const url = data?.signedUrl ?? null;

      if (url) {
        signedUrlCacheRef.current.set(key, {
          url,
          expiresAt: now + expiresIn * 1000,
        });
      }

      return url;
    } catch (err: any) {
      if (isAbortError(err)) return null;

      if (isObjectNotFound(err)) {
        missingKeysRef.current.add(key);
      }

      return null;
    }
  },
  []
);

  const loadAllAttachments = useCallback(async (): Promise<Record<string, any[]>> => {
    try {
      const { data, error } = await supabase
        .from("message_attachments")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const attachmentsByMessage: Record<string, any[]> = {};

      await Promise.all(
        (data || []).map(async (attachment: any) => {
          const rawFileUrl = attachment.file_url || "";
          const rawThumbUrl = attachment.thumbnail_url || "";

          const [freshFileUrl, freshThumbUrl] = await Promise.all([
            getSignedUrlOrNull(rawFileUrl, 3600),
            rawThumbUrl ? getSignedUrlOrNull(rawThumbUrl, 3600) : Promise.resolve(null),
          ]);

          const patched = {
            ...attachment,
            file_url: freshFileUrl || rawFileUrl,
            thumbnail_url: freshThumbUrl || (isTempPath(rawThumbUrl) ? null : rawThumbUrl || null),
          };

          const mid = attachment.message_id;
          if (!attachmentsByMessage[mid]) attachmentsByMessage[mid] = [];
          attachmentsByMessage[mid].push(patched);
        })
      );

      setMessageAttachments(attachmentsByMessage);
      return attachmentsByMessage;
    } catch (err: any) {
      if (isAbortError(err)) return {};
      console.error("Error loading attachments:", err);
      setMessageAttachments({});
      return {};
    }
  }, [getSignedUrlOrNull]);


const openProfile = useCallback(
  (senderId?: string) => {
    if (!senderId) return;

    navigate(`/profile/${senderId}`);
  },
  [navigate, user?.id]
);
  useEffect(() => {
    if (!authed || !user?.id) return;

    let cancelled = false;


const loadMessages = async () => {
  try {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("messages")
      .select(
        `
        id,
        content,
        created_at,
        edited_at,
        is_deleted,
        sender_id,
        reactions,
        message_type,
        hidden_after,
        profiles(full_name, location)
      `
      )
      .eq("is_deleted", false)
      .eq("message_type", COMMUNITY_MESSAGE_TYPE)
      .or(`hidden_after.is.null,hidden_after.gt.${nowIso}`)
      .order("created_at", { ascending: true });


    if (cancelled) return;
    if (error) throw error;

    const formatted: Message[] = (data || []).map((msg: any) => ({
      id: msg.id,
      user:
        msg.profiles?.full_name ||
        `User ${String(msg.sender_id || "").slice(0, 8)}`,
      message: msg.content || "",
      time: new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      location:
        msg.profiles?.location ||
        t("locationNotSet", { defaultValue: "Location not set" }),
      likes: 0,
      isOwn: msg.sender_id === user.id,
      edited_at: msg.edited_at
        ? new Date(msg.edited_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
      is_deleted: msg.is_deleted,
      sender_id: msg.sender_id,
      reactions:
        (msg.reactions as Record<string, string[]>) || {},
      message_type: msg.message_type,
    }));

    setMessages(formatted);
    void loadAllAttachments();
  } catch (err: any) {
    if (cancelled) return;
    if (isAbortError(err)) return;
    console.error("[chat] Error loading messages:", err);
  }
};

    void loadMessages();

    const channel = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        if (cancelled) return;
        const row = payload.new as any;

        if (row?.message_type !== COMMUNITY_MESSAGE_TYPE) return;
        if (row?.is_deleted) return;

        const prof = row?.sender_id ? await getProfileCached(row.sender_id) : { full_name: null, location: null };

        const formattedMessage: Message = {
          id: row.id,
          user: prof.full_name || `User ${String(row.sender_id || "").slice(0, 8)}`,
          message: row.content || "",
          time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          location: prof.location || t("locationNotSet", { defaultValue: "Location not set" }),
          likes: 0,
          isOwn: row.sender_id === user.id,
          sender_id: row.sender_id,
          reactions: (row.reactions as Record<string, string[]>) || {},
          message_type: row.message_type,
        };

        setMessages((prev) => [...prev, formattedMessage]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        if (cancelled) return;
        const updated = payload.new as any;

        if (updated?.message_type !== COMMUNITY_MESSAGE_TYPE) return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === updated.id
              ? {
                  ...m,
                  message: updated.is_deleted
                    ? t("deletedMessage", { defaultValue: "This message has been deleted" })
                    : updated.content || "",
                  edited_at: updated.edited_at
                    ? new Date(updated.edited_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : undefined,
                  is_deleted: updated.is_deleted,
                  reactions: (updated.reactions as Record<string, string[]>) || m.reactions || {},
                }
              : m
          )
        );
      })
      .subscribe();

    const attachmentsChannel = supabase
      .channel("message_attachments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_attachments" }, async (payload) => {
        if (cancelled) return;

        const newAttachment = payload.new as any;

        if (!messageIdsRef.current.has(newAttachment.message_id)) return;

        try {
          const freshFileUrl = (await getSignedUrlOrNull(newAttachment.file_url, 3600)) || newAttachment.file_url;

          const freshThumbUrl = newAttachment.thumbnail_url
            ? (await getSignedUrlOrNull(newAttachment.thumbnail_url, 3600)) || null
            : null;

          const patched = { ...newAttachment, file_url: freshFileUrl, thumbnail_url: freshThumbUrl };

          setMessageAttachments((prev) => ({
            ...prev,
            [patched.message_id]: [...(prev[patched.message_id] || []), patched],
          }));
        } catch (err: any) {
          if (isAbortError(err)) return;

          setMessageAttachments((prev) => ({
            ...prev,
            [newAttachment.message_id]: [
              ...(prev[newAttachment.message_id] || []),
              {
                ...newAttachment,
                thumbnail_url: isTempPath(newAttachment.thumbnail_url) ? null : newAttachment.thumbnail_url || null,
              },
            ],
          }));
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(attachmentsChannel);
    };
  }, [authed, user?.id, loadAllAttachments, getSignedUrlOrNull, t, getProfileCached]);

const handleSend = async () => {
  if (!recorder.isRecording()) {
    setError("No recording in progress. Please try again.");
    return;
  }

  try {
    setIsRecording(false);

    const finalDuration = recorder.getDuration();
    const { blob: audioBlob, mimeType } = await recorder.stopRecording();

    if (audioBlob.size < 1000) {
      setError("Recording failed - audio too short or empty. Please try again.");
      console.error("[VoiceRecorder] Invalid blob size:", audioBlob.size);
      return;
    }

    console.log("[VoiceRecorder] Sending voice message:", {
      size: audioBlob.size,
      duration: finalDuration,
      mimeType,
    });

    await onSend(audioBlob, finalDuration, mimeType);
  } catch (err) {
    console.error("[VoiceRecorder] Error:", err);
    setError("Failed to send voice message");
    setIsRecording(false);
  }
};

const handleSendMessage = async () => {
  const body = newMessage.trim();

  if (!body || !user?.id) return;

  try {
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      content: body,
      message_type: COMMUNITY_MESSAGE_TYPE,
      hidden_after: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    if (error) throw error;

    setNewMessage("");
  } catch (error: any) {
    if (isAbortError(error)) return;
    console.error("[ChatRoom] send failed:", error);
  }
};

  const handleVoiceMessageSend = async (audioBlob: Blob, durationSeconds: number, mimeType: string) => {
    if (!user?.id) return;

    try {
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
   .insert({
     sender_id: user.id,
     content: "",
     message_type: COMMUNITY_MESSAGE_TYPE,
     metadata: { duration: durationSeconds, mimeType, kind: "voice" },
     hidden_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
   })
        .select()
        .single();

      if (messageError) throw messageError;

      const filePath = await uploadVoiceMessage(audioBlob, messageData.id, user.id, mimeType);
      await recordVoiceAttachment(messageData.id, filePath, mimeType, audioBlob.size, user.id);


      setIsRecordingVoice(false);
      toast({
        title: t("voice.sentTitle", { defaultValue: "Voice message sent" }),
        description: t("voice.sentDesc", { defaultValue: "Your voice message has been sent to the chat." }),
      });
    } catch (error: any) {
      if (isAbortError(error)) return;
      toast({
        title: t("voice.failedTitle", { defaultValue: "Failed to send" }),
        description: error?.message || t("voice.failedDesc", { defaultValue: "Failed to send voice message." }),
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessage(messageId);
    setEditText(currentText);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editText.trim() || !user?.id) return;

    try {
      const { error } = await supabase
        .from("messages")
        .update({ content: editText.trim(), edited_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .eq("message_type", COMMUNITY_MESSAGE_TYPE);

      if (error) throw error;

      setEditingMessage(null);
      setEditText("");
    } catch (err: any) {
      if (isAbortError(err)) return;
      console.error("[chat] Error saving edit:", err);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .eq("message_type", COMMUNITY_MESSAGE_TYPE);

      if (error) throw error;
    } catch (err: any) {
      if (isAbortError(err)) return;
      console.error("[chat] Error deleting message:", err);
    }
  };

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("authRequiredTitle", { defaultValue: "Authentication Required" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t("authRequiredBody", { defaultValue: "Please sign in to access the community chat." })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
   <div className="h-[100dvh] overflow-hidden bg-gradient-to-br from-background to-secondary/30 pt-2">
      <div className="container mx-auto px-2 max-w-6xl h-full">
       <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 h-full">
        <div className="hidden lg:block lg:col-span-1">
            <Card className="h-full shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="text-islamic-green" size={20} />
                  {t("online", { defaultValue: "Online" })} ({onlineCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="p-4 space-y-3">
                    {onlineUsers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t("noConnectionsYet", { defaultValue: "No connections yet" })}
                      </div>
                    ) : (
                      onlineUsers.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => openProfile(u.user_id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                        >
                          <div className="relative">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {u.name.charAt(0)}
                              </div>
                            )}

                            <div
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                                u.status === "online" ? "bg-green-500" : "bg-yellow-500"
                              }`}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.location}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

         <div className="lg:col-span-3 min-h-0">
            <Card className="h-full shadow-lg flex flex-col overflow-hidden">
          <CardHeader className="px-3 py-2 border-b border-border/50">
                    <div className="flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center">
  <img
    src="/tariq-logo.png"
    alt="Tariq Islam"
    className="w-full h-full object-cover"
  />
</div>

  <div>
    <CardTitle className="text-base font-bold">
      Community Feed
    </CardTitle>
   <p className="text-sm text-muted-foreground">
     Share beneficial reminders, questions, events and community updates
   </p>
  </div>
</div>

        <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      {t("onlineCount", { count: onlineCount, defaultValue: "{{count}} online" })}
                    </Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 hover:bg-secondary/50 rounded-lg transition-colors" type="button">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-popover z-50" align="end">
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            navigate("/community-guidelines?embed=1");
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <span>{t("menu.guidelines", { defaultValue: "Community Guidelines" })}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.location.reload()}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          <span>{t("menu.refresh", { defaultValue: "Refresh Chat" })}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            toast({
                              title: t("menu.reportToastTitle", { defaultValue: "Report Issue" }),
                              description: t("menu.reportToastDesc", {
                                defaultValue: "Please contact support if you notice any issues.",
                              }),
                            });
                          }}
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          <span>{t("menu.report", { defaultValue: "Report Issue" })}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 max-w-xl mx-auto">
               <ScrollArea className="h-[calc(100dvh-150px)] px-2 py-2 pb-16">
                <div className="w-full">
                    {messages.map((message) => (
      <div key={message.id} className="flex gap-2 items-start">
                        <button
                          type="button"
                          onClick={() => openProfile(message.sender_id)}
                          className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                        >
                          {message.user.charAt(0)}
                        </button>

             <div className="flex-1 max-w-md text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              type="button"
                              onClick={() => openProfile(message.sender_id)}
                              className="font-medium text-sm hover:underline"
                            >
                              {message.user}
                            </button>
                            <span className="text-xs text-muted-foreground">{message.time}</span>
                            <span className="text-xs text-muted-foreground">• {message.location}</span>
                            {message.edited_at && (
                              <span className="text-xs text-muted-foreground italic">
                                ({t("edited", { defaultValue: "edited" })})
                              </span>
                            )}
                          </div>

  {editingMessage === message.id ? (
    <div className="space-y-2">
      <Input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        className="text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSaveEdit(message.id);
          if (e.key === "Escape") handleCancelEdit();
        }}
        autoFocus
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSaveEdit(message.id)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
        >
          <Check size={12} />
          {t("save", { defaultValue: "Save" })}
        </button>

        <button
          type="button"
          onClick={handleCancelEdit}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
        >
          <X size={12} />
          {t("cancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    </div>
  ) : (
    <div className="relative group">
                              <div
                                className={[
                                  "rounded-2xl border bg-card shadow-sm overflow-hidden",
                                  "px-4 py-3",
                                  message.is_deleted ? "opacity-60 italic" : "",
                                ].join(" ")}
                              >

{message.message && (
  <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
    {message.message}
  </p>
)}

                                {messageAttachments[message.id]?.map((attachment) => (
                                  <div key={attachment.id} className="mt-2">
                                    <MessageAttachment attachment={attachment} />
                                  </div>
                                ))}
                              </div>

                              {message.isOwn && !message.is_deleted && (
                                <div
                                  className={`absolute top-2 ${
                                    message.isOwn ? "left-2" : "right-2"
                                  } opacity-0 group-hover:opacity-100 transition-opacity`}
                                >
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className="p-1 rounded hover:bg-black/10 transition-colors">
<MoreVertical size={16} className="text-muted-foreground" />
                                      </button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent align="start" className="w-32">
                                      <DropdownMenuItem
                                        onClick={() => handleEditMessage(message.id, message.message)}
                                        className="flex items-center gap-2 text-sm"
                                      >
                                        <Edit2 size={12} />
                                        {t("edit", { defaultValue: "Edit" })}
                                      </DropdownMenuItem>

                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem
                                            onSelect={(e) => e.preventDefault()}
                                            className="flex items-center gap-2 text-sm text-red-600 focus:text-red-600"
                                          >
                                            <Trash2 size={12} />
                                            {t("deleteDialog.confirm", { defaultValue: "Delete" })}
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>

                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>
                                              {t("deleteDialog.title", { defaultValue: "Delete Message" })}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              {t("deleteDialog.desc", {
                                                defaultValue:
                                                  "Are you sure you want to delete this message? This action cannot be undone.",
                                              })}
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>
                                              {t("deleteDialog.cancel", { defaultValue: "Cancel" })}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => void handleDeleteMessage(message.id)}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              {t("deleteDialog.confirm", { defaultValue: "Delete" })}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {message.isOwn && message.status && (
                              <MessageStatus status={message.status} className="text-muted-foreground" />
                            )}
                          </div>

                          {!message.is_deleted && (
                            <div className="mt-2">
                              <MessageReactions messageId={message.id} reactions={message.reactions || {}} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

   <ChatComposer
     className="sticky bottom-0 z-50 w-full border-t bg-background px-4 py-2"
                value={newMessage}
                onChange={setNewMessage}
                onSend={async () => {
                  await handleSendMessage();
                }}
                placeholder={t("input.placeholder", {
defaultValue: "Share something with the community...",
                })}
                emojiAriaLabel={t("input.emojiAria", { defaultValue: "Emoji" })}
                sendAriaLabel={t("input.send", { defaultValue: "Send" })}
                onEmojiClick={() => {
                  toast({
                    title: t("input.emojiAria", { defaultValue: "Emoji" }),
                    description: t("input.emojiNotImplemented", { defaultValue: "Emoji picker not added yet." }),
                  });
                }}
                actions={
                  <>
                    <ImageUpload
                      onImageSelect={() => {}}
                      onImageRemove={() => {}}
                      onUploadComplete={async (data) => {
                        if (!user?.id) {
                          data.reset();
                          return;
                        }

                        try {
                          const { data: messageData, error: messageError } = await supabase
                            .from("messages")

                            .insert({
                              sender_id: user.id,
                              content: "",
                              message_type: COMMUNITY_MESSAGE_TYPE,
                              metadata: { kind: "image" },
                              hidden_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            })
                            .select()
                            .single();

                          if (messageError) throw messageError;

                          const { error: attachmentError } = await supabase.from("message_attachments").insert({
                            message_id: messageData.id,
                            file_type: "image",
                            file_url: data.imageUrl,
                            thumbnail_url: data.thumbnailUrl,
                            file_name: "image.jpg",
                            file_size: data.metadata.originalSize || 0,
                            uploaded_by: user.id,
                            metadata: data.metadata,
                          });

                          if (attachmentError) throw attachmentError;

                          setMessageAttachments((prev) => ({
                            ...prev,
                            [messageData.id]: [
                              {
                                id: crypto.randomUUID(),
                                message_id: messageData.id,
                                file_type: "image",
                                file_url: data.imageUrl,
                                thumbnail_url: data.thumbnailUrl,
                                file_name: "image.jpg",
                                file_size: data.metadata.originalSize || 0,
                                metadata: data.metadata,
                              },
                            ],
                          }));

                          toast({
                            title: t("image.sentTitle", { defaultValue: "Image sent" }),
                            description: t("image.sentDesc", { defaultValue: "Your image has been shared in the chat." }),
                          });
                          data.reset();
                        } catch (error: any) {
                          if (!isAbortError(error)) {
                            toast({
                              title: t("image.failedTitle", { defaultValue: "Failed to send" }),
                              description: error?.message || t("image.failedDesc", { defaultValue: "Failed to send image." }),
                              variant: "destructive",
                            });
                          }
                          data.reset();
                        }
                      }}
                      messageId={`temp-${Date.now()}`}
                      userId={user?.id || ""}
                    />

                    <HeroButton
                      type="button"
                      onClick={() => setIsRecordingVoice(true)}
                      size="lg"
                      variant="secondary"
                      className="text-islamic-green hover:text-white"
                      aria-label={t("voice.recordAria", { defaultValue: "Record voice message" })}
                      title={t("voice.recordAria", { defaultValue: "Record voice message" })}
                    >
                      <Mic size={18} />
                    </HeroButton>
                  </>
                }
           helperText=""
              />
            </Card>
          </div>
        </div>

        {isRecordingVoice && (
          <VoiceMessageRecorder onSend={handleVoiceMessageSend} onCancel={() => setIsRecordingVoice(false)} />
        )}
      </div>
    </div>
  );
};

export default ChatRoom;