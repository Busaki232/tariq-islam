// src/components/GroupChatWindow.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, Settings, Loader2, MoreVertical, Flag, Ban } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Group } from "@/hooks/useUserGroups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  group: Group;
  onOpenSettings?: () => void;
};

type MsgRow = {
  id: string;
  content: string | null;
  created_at: string;
  sender_id: string;
  group_id: string | null;
};

const UGC_TERMS_KEY = "ugc_terms_accepted_v1";

function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function logSupabaseError(label: string, error: any) {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    status: error?.status,
    statusText: error?.statusText,
    name: error?.name,
  });
}

function getGroupTitle(g: any) {
  return (g?.name || g?.title || g?.group_name || "").toString().trim() || "Group";
}

export default function GroupChatWindow({ group, onOpenSettings }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("privateChat");
  const { user } = useAuth();
  const { toast } = useToast();

  const me = user?.id ?? "";
  const groupId = String((group as any)?.id || "");
  const title = useMemo(() => getGroupTitle(group), [group]);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [text, setText] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [groupBlocked, setGroupBlocked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    const el = endRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      setAcceptedTerms(localStorage.getItem(UGC_TERMS_KEY) === "true");
    } catch {
      setAcceptedTerms(false);
    }
  }, []);

  const acceptTerms = () => {
    try {
      localStorage.setItem(UGC_TERMS_KEY, "true");
    } catch {
      // ignore
    }
    setAcceptedTerms(true);
  };

  useEffect(() => {
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!groupId) {
        setErrorText("Missing group id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const { data, error } = (await withTimeout(
          supabase
            .from("messages")
            .select("id,content,created_at,sender_id,group_id")
            .eq("group_id", groupId)
            .order("created_at", { ascending: true })
            .limit(50),
          15000
        )) as any;

        if (error) {
          logSupabaseError("[GroupChatWindow] LOAD_MESSAGES_ERROR", error);
          throw error;
        }

        if (!cancelled) {
          setMessages((data || []) as MsgRow[]);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrorText(e?.message || "Failed to load messages");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId || groupBlocked) return;

    const channel = supabase
      .channel(`group-messages:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.new as any;
          const next: MsgRow = {
            id: String(row.id),
            content: row.content ?? null,
            created_at: row.created_at,
            sender_id: String(row.sender_id),
            group_id: row.group_id ?? null,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        }
      )
      .subscribe((status) => {
        console.log("[GroupChatWindow] realtime status", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, groupBlocked]);

  const reportGroup = async () => {
    if (!me || !groupId || reporting) return;

    const reason = window.prompt(
      "Report group\n\nEnter a reason:\nExample: abuse, hate, spam, explicit content",
      "spam"
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
          reported_by: me,
          reported_user_id: me,
          message_id: groupId,
          reason: `Group report: ${trimmedReason}`,
          details: details.trim() || `Reported group: ${title}`,
        }),
        15000
      );

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: `Your report about ${title} has been sent for review.`,
      });
    } catch (e: any) {
      logSupabaseError("[GroupChatWindow] REPORT_GROUP_ERROR", e);
      toast({
        title: "Failed to submit report",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setReporting(false);
    }
  };

  const blockGroup = async () => {
    if (!groupId || blocking) return;

    const ok = window.confirm(
      `Block ${title}?\n\nIts messages will be removed from your view immediately.`
    );
    if (!ok) return;

    setBlocking(true);
    try {
      const storageKey = `blocked_group_${groupId}`;
      try {
        localStorage.setItem(storageKey, "true");
      } catch {
        // ignore
      }

      const { error } = await withTimeout(
        supabase.from("reports").insert({
          reported_by: me,
          reported_user_id: me,
          message_id: groupId,
          reason: "Blocked abusive group",
          details: `User blocked group: ${title}`,
        }),
        15000
      );

      if (error) {
        console.log("[GroupChatWindow] report on block failed:", error);
      }

      setGroupBlocked(true);
      setMessages([]);

      toast({
        title: "Group blocked",
        description: `${title} has been blocked and removed from your view.`,
      });
    } catch (e: any) {
      logSupabaseError("[GroupChatWindow] BLOCK_GROUP_ERROR", e);
      toast({
        title: "Failed to block group",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    try {
      const storageKey = `blocked_group_${groupId}`;
      setGroupBlocked(localStorage.getItem(storageKey) === "true");
    } catch {
      setGroupBlocked(false);
    }
  }, [groupId]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    if (!me) {
      setErrorText(t("toast.signInRequired", { defaultValue: "Sign in required" }));
      return;
    }
    if (groupBlocked) return;

    setErrorText("");
    setText("");

    try {
      const { error } = await withTimeout(
        supabase.from("messages").insert({
          content,
          sender_id: me,
          group_id: groupId,
          message_type: "group",
        }),
        15000
      );

      if (error) {
        logSupabaseError("[GroupChatWindow] SEND_MESSAGE_ERROR", error);
        throw error;
      }
    } catch (e: any) {
      setErrorText(e?.message || "Failed to send message");
      setText(content);
    }
  };

  return (
    <div className="h-full w-full flex flex-col relative">
      {!acceptedTerms ? (
        <div className="absolute inset-0 z-50 bg-background text-foreground flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
            <h2 className="text-2xl font-semibold mb-3">Terms of Use</h2>

            <p className="text-sm text-muted-foreground mb-4">
              Before accessing group content, you must agree to use Tariq Islam respectfully and responsibly.
            </p>

            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>No abusive, hateful, explicit, or harmful content.</li>
              <li>No harassment, scams, impersonation, or spam.</li>
              <li>Objectionable content and abusive users or groups may be reported and blocked.</li>
              <li>By continuing, you agree to follow community guidelines and respectful conduct.</li>
            </ul>

            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={acceptTerms} type="button">
                I Agree
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="border-b bg-background px-3 py-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages", { replace: true })}
          aria-label={t("actions.back", { defaultValue: "Back" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {t("groupChat.subtitle", { defaultValue: "Group chat" })}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Group safety actions"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void reportGroup()} disabled={reporting}>
              <Flag className="h-4 w-4 mr-2" />
              {reporting ? "Reporting..." : "Report group"}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => void blockGroup()}
              disabled={blocking}
              className="text-destructive"
            >
              <Ban className="h-4 w-4 mr-2" />
              {blocking ? "Blocking..." : "Block group"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenSettings?.()}
          aria-label={t("actions.settings", { defaultValue: "Settings" })}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {groupBlocked ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            You blocked this group. Its content has been removed from your view.
          </div>
        ) : loading ? (
          <div className="h-full w-full flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : errorText ? (
          <div className="text-sm text-destructive">{errorText}</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("groupChat.noMessagesYet", { defaultValue: "No messages yet." })}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = me && m.sender_id === me;
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm border ${
                    mine ? "ml-auto bg-muted" : "mr-auto bg-background"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content || ""}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={groupBlocked}
          placeholder={
            groupBlocked
              ? "You blocked this group"
              : t("groupChat.typeMessage", { defaultValue: "Type a message..." })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button onClick={() => void send()} disabled={!text.trim() || groupBlocked} className="gap-2">
          <Send className="h-4 w-4" />
          {t("actions.send", { defaultValue: "Send" })}
        </Button>
      </div>
    </div>
  );
}