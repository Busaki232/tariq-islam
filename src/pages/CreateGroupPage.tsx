// src/pages/CreateGroupPage.tsx
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserConnections } from "@/hooks/useUserConnections";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ConnectedUserLite = {
  user_id: string;
  full_name: string | null;
  location?: string | null;
  avatar_url: string | null;
};

function safeName(name: string | null | undefined, fallback: string) {
  const n = (name || "").trim();
  return n || fallback;
}

function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function logSupabaseError(label: string, error: any) {
  const payload = {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    status: error?.status,
    statusText: error?.statusText,
    name: error?.name,
  };
  console.error(label, payload);
  return payload;
}

export default function CreateGroupPage() {
  const { t } = useTranslation("privateChat");
  const navigate = useNavigate();
  const { user } = useAuth();

  const me = user?.id ?? "";

  const {
    connectedUsers = [],
    loading: loadingConnections,
    errorText: connectionsError,
    reload: reloadConnections,
  } = useUserConnections();

  const connections = useMemo(
    () => (connectedUsers || []) as ConnectedUserLite[],
    [connectedUsers]
  );

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState("");

  const unknownUser = t("labels.unknownUser", { defaultValue: "Unknown User" });

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((p) => {
      const name = (p.full_name || "").toLowerCase();
      const loc = (p.location || "").toLowerCase();
      return name.includes(q) || loc.includes(q);
    });
  }, [connections, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Prevent accidental double submits even if state batching delays "creating"
  const inFlightRef = useRef(false);

  const handleCreate = async () => {
    if (!me) {
      setErrorText(t("toast.signInRequired", { defaultValue: "Sign in required" }));
      return;
    }

    const name = (groupName || "").trim();
    if (!name) {
      setErrorText(
        t("createGroup.groupNameLabel", { defaultValue: "Group name" }) + " is required"
      );
      return;
    }

    if (creating || inFlightRef.current) return;

    setCreating(true);
    setErrorText("");
    inFlightRef.current = true;

    const startedAt = performance.now();
    const runId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const dbg = (...args: any[]) => console.log(`[CreateGroupPage ${runId}]`, ...args);

    try {
      dbg("START", {
        me,
        name,
        selectedCount: selectedIds.length,
        selectedIds,
      });

      // Optional: check session quickly, helps diagnose "signed out" surprises
      try {
        const { data: sessData, error: sessErr } = await withTimeout(
          supabase.auth.getSession(),
          8000
        );
        if (sessErr) logSupabaseError(`[CreateGroupPage ${runId}] SESSION_ERROR`, sessErr);
        dbg("SESSION", {
          hasSession: !!sessData?.session,
          sessionUser: sessData?.session?.user?.id || null,
          expiresAt: sessData?.session?.expires_at || null,
        });
      } catch (e) {
        dbg("SESSION_CHECK_FAILED", e);
      }

      // 1) Create group in chat_groups
      dbg("STEP_1_INSERT_GROUP_BEGIN");
      const groupInsertStart = performance.now();

      const groupRes = await withTimeout(
        supabase
          .from("chat_groups")
          .insert({
            name,
            group_type: "private",
            created_by: me,
          })
          .select("*")
          .single(),
        15000
      );

      const { data: groupRow, error: gErr } = groupRes as any;

      dbg("STEP_1_INSERT_GROUP_DONE", {
        ms: Math.round(performance.now() - groupInsertStart),
        hasRow: !!groupRow,
      });

      if (gErr) {
        logSupabaseError(`[CreateGroupPage ${runId}] GROUP_INSERT_ERROR`, gErr);
        throw gErr;
      }
      if (!groupRow?.id) {
        const err = new Error("Group create returned no id");
        dbg("GROUP_ROW", groupRow);
        throw err;
      }

      const groupId = String(groupRow.id);
      dbg("GROUP_CREATED", { groupId, groupRow });

      // 2) Add creator + selected members into chat_group_members
      const memberIds = Array.from(new Set([me, ...selectedIds])).filter(Boolean);
      const memberRows = memberIds.map((uid) => ({
        group_id: groupId,
        user_id: uid,
        role: uid === me ? "admin" : "member",
      }));

      dbg("STEP_2_INSERT_MEMBERS_BEGIN", {
        memberCount: memberRows.length,
        memberIds,
      });

      const membersInsertStart = performance.now();

      const memberRes = await withTimeout(
        supabase.from("chat_group_members").insert(memberRows),
        15000
      );

      const { error: mErr } = memberRes as any;

      dbg("STEP_2_INSERT_MEMBERS_DONE", {
        ms: Math.round(performance.now() - membersInsertStart),
      });

      if (mErr) {
        logSupabaseError(`[CreateGroupPage ${runId}] MEMBERS_INSERT_ERROR`, mErr);
        throw mErr;
      }

      // 2b) Quick verification read (helps detect RLS select issues early)
      // If this fails, you still navigate, but you’ll see why.
      try {
        dbg("STEP_2B_VERIFY_BEGIN");
        const { data: verify, error: vErr } = await withTimeout(
          supabase
            .from("chat_group_members")
            .select("group_id,user_id,role")
            .eq("group_id", groupId),
          12000
        );
        if (vErr) logSupabaseError(`[CreateGroupPage ${runId}] VERIFY_MEMBERS_ERROR`, vErr);
        dbg("STEP_2B_VERIFY_DONE", {
          rows: Array.isArray(verify) ? verify.length : null,
          sample: Array.isArray(verify) ? verify.slice(0, 5) : verify,
        });
      } catch (e) {
        dbg("STEP_2B_VERIFY_FAILED", e);
      }

      // 3) Navigate to group chat page
      const totalMs = Math.round(performance.now() - startedAt);
      dbg("SUCCESS", { groupId, totalMs });

      navigate(`/messages/groups/${groupId}`, { replace: true });
    } catch (e: any) {
      const msg =
        e?.message ||
        t("directory.searchFailed", { defaultValue: "Failed to create group." });

      setErrorText(msg);

      console.error(`[CreateGroupPage ${runId}] CREATE_FAILED_RAW`, e);

      // Extra: common Supabase error hints right in console
      const code = e?.code;
      if (code) {
        console.warn(`[CreateGroupPage ${runId}] ERROR_CODE`, code);
        if (code === "42501") {
          console.warn(
            `[CreateGroupPage ${runId}] Hint: 42501 is often RLS / permission denied. Check policies for chat_groups and chat_group_members.`
          );
        }
      }
    } finally {
      inFlightRef.current = false;
      setCreating(false);
      dbg("FINALLY_DONE");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5" />
        <h1 className="text-lg font-semibold">
          {t("createGroup.title", { defaultValue: "Create new group" })}
        </h1>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium mb-1">
            {t("createGroup.groupNameLabel", { defaultValue: "Group name" })}
          </div>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("createGroup.groupNamePlaceholder", {
              defaultValue: "Example: Lagos Brothers",
            })}
            disabled={creating}
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {t("createGroup.addMembersOptional", {
                defaultValue: "Add members now (optional)",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t(
                "createGroup.selectedCount",
                { defaultValue: "Selected: {{count}}" },
                { count: selectedIds.length }
              )}
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("createGroup.searchConnections", {
                defaultValue: "Search your connections...",
              })}
              className="pl-10"
              disabled={creating}
            />
          </div>

          <div className="mt-3 max-h-[360px] overflow-y-auto border rounded-lg p-2">
            {loadingConnections ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : connectionsError ? (
              <div className="p-3">
                <div className="text-sm text-destructive">{connectionsError}</div>
                <div className="mt-3">
                  <Button variant="outline" onClick={() => void reloadConnections()}>
                    {t("actions.retry", { defaultValue: "Retry" })}
                  </Button>
                </div>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {t("createGroup.noConnections", { defaultValue: "No connections yet" })}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {t("createGroup.noMatches", { defaultValue: "No matches" })}
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((p) => {
                  const name = safeName(p.full_name, unknownUser);
                  const checked = selectedIds.includes(p.user_id);

                  return (
                    <div
                      key={p.user_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(p.user_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(p.user_id);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-left cursor-pointer select-none"
                      aria-pressed={checked}
                    >
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onCheckedChange={() => toggle(p.user_id)} />
                      </div>

                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.avatar_url || ""} alt={name} />
                        <AvatarFallback>
                          {(name.charAt(0) || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.location || " "}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {errorText ? <div className="text-sm text-destructive">{errorText}</div> : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate("/messages", { replace: true })}
            disabled={creating}
          >
            {t("actions.close", { defaultValue: "Close" })}
          </Button>

          <Button
            onClick={handleCreate}
            disabled={creating || !groupName.trim()}
            className="gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {creating
              ? t("createGroup.creating", { defaultValue: "Creating..." })
              : t("createGroup.createBtn", { defaultValue: "Create group" })}
          </Button>
        </div>
      </div>
    </div>
  );
}