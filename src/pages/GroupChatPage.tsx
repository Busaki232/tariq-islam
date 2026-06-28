// src/pages/GroupChatPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GroupChatWindow from "@/components/GroupChatWindow";
import type { Group } from "@/hooks/useUserGroups";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

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

type MemberRow = {
  user_id: string;
  role: string | null;
  created_at?: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

function memberName(m: MemberRow) {
  const full = (m.profiles?.full_name || "").trim();
  const usern = (m.profiles?.username || "").trim();
  if (full) return full;
  if (usern) return usern;
  return m.user_id.length > 12 ? `${m.user_id.slice(0, 8)}…${m.user_id.slice(-4)}` : m.user_id;
}

export default function GroupChatPage() {
  const { t } = useTranslation("privateChat");
  const { user } = useAuth();

  const { groupId } = useParams();
  const navigate = useNavigate();

  const id = useMemo(() => (groupId || "").trim(), [groupId]);
  const me = user?.id ?? "";

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [showSettings, setShowSettings] = useState(false);

  // Settings state
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const myRole = useMemo(() => {
    const r = members.find((m) => m.user_id === me)?.role || "";
    return String(r).toLowerCase();
  }, [members, me]);

  const isAdmin = myRole === "admin" || myRole === "owner";

  // Helps correlate logs across hot reloads and multiple navigations
  const runIdRef = useRef<string>("");
  if (!runIdRef.current) {
    runIdRef.current = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
  const runId = runIdRef.current;
  const dbg = (...args: any[]) => console.log(`[GroupChatPage ${runId}]`, ...args);

  useEffect(() => {
    dbg("MOUNT", { groupId, id });
    return () => {
      dbg("UNMOUNT");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        dbg("MISSING_ID");
        setErrorText("Missing group id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      const startedAt = performance.now();
      dbg("LOAD_BEGIN", { id });

      try {
        const res = await withTimeout(
          supabase.from("chat_groups").select("*").eq("id", id).maybeSingle(),
          15000
        );

        const { data, error } = res as any;

        dbg("LOAD_QUERY_DONE", {
          ms: Math.round(performance.now() - startedAt),
          hasData: !!data,
        });

        if (error) {
          logSupabaseError(`[GroupChatPage ${runId}] GROUP_FETCH_ERROR`, error);
          throw error;
        }

        if (!data) {
          throw new Error("Group not found");
        }

        if (!cancelled) {
          setGroup(data as Group);
          setRenameValue(String((data as any)?.name || ""));
          dbg("GROUP_SET", { id: (data as any)?.id, name: (data as any)?.name });
        }
      } catch (e: any) {
        dbg("LOAD_FAILED", { message: e?.message, code: e?.code });
        if (!cancelled) setErrorText(e?.message || "Failed to load group");
      } finally {
        if (!cancelled) {
          setLoading(false);
          dbg("LOAD_END", { ms: Math.round(performance.now() - startedAt) });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load settings info when opening settings
  const loadSettings = async () => {
    if (!id) return;
    setLoadingSettings(true);
    setSettingsError("");

    dbg("SETTINGS_LOAD_BEGIN", { id });

    try {
      const { data, error } = (await withTimeout(
        supabase
          .from("chat_group_members")
          .select("user_id,role,created_at, profiles:profiles!chat_group_members_user_id_profiles_fkey(full_name,username,avatar_url)")
          .eq("group_id", id)
          .order("created_at", { ascending: true }),
        15000
      )) as any;

      if (error) {
        logSupabaseError(`[GroupChatPage ${runId}] SETTINGS_MEMBERS_ERROR`, error);
        throw error;
      }

      const rows = Array.isArray(data) ? (data as MemberRow[]) : [];
      setMembers(rows);
      dbg("SETTINGS_LOAD_DONE", { count: rows.length, myRole: rows.find((m) => m.user_id === me)?.role });
    } catch (e: any) {
      setSettingsError(e?.message || "Failed to load settings");
      dbg("SETTINGS_LOAD_FAILED", { message: e?.message, code: e?.code });
    } finally {
      setLoadingSettings(false);
    }
  };

  const openSettings = async () => {
    setShowSettings(true);
    await loadSettings();
  };

  const handleRename = async () => {
    if (!id || !group) return;
    if (!isAdmin) return;

    const nextName = (renameValue || "").trim();
    if (!nextName) {
      setSettingsError("Group name is required");
      return;
    }

    setSavingName(true);
    setSettingsError("");

    try {
      const { data, error } = (await withTimeout(
        supabase
          .from("chat_groups")
          .update({ name: nextName })
          .eq("id", id)
          .select("*")
          .maybeSingle(),
        15000
      )) as any;

      if (error) {
        logSupabaseError(`[GroupChatPage ${runId}] RENAME_ERROR`, error);
        throw error;
      }

      if (data) {
        setGroup(data as Group);
      }
    } catch (e: any) {
      setSettingsError(e?.message || "Failed to rename group");
    } finally {
      setSavingName(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!id || !me) {
      setSettingsError("Sign in required");
      return;
    }

    // Optional confirmation
    const ok = window.confirm("Leave this group?");
    if (!ok) return;

    setLeaving(true);
    setSettingsError("");

    try {
      const { error } = (await withTimeout(
        supabase
          .from("chat_group_members")
          .delete()
          .eq("group_id", id)
          .eq("user_id", me),
        15000
      )) as any;

      if (error) {
        logSupabaseError(`[GroupChatPage ${runId}] LEAVE_GROUP_ERROR`, error);
        throw error;
      }

      // Go back to messages after leaving
      navigate("/messages", { replace: true });
    } catch (e: any) {
      setSettingsError(e?.message || "Failed to leave group");
    } finally {
      setLeaving(false);
    }
  };

  // If you're still seeing a spinner forever, this tells us whether it's THIS page or inside GroupChatWindow
  useEffect(() => {
    dbg("STATE", { loading, hasGroup: !!group, errorText });
  }, [loading, group, errorText]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group || errorText) {
    return (
      <div className="p-6">
        <div className="text-sm text-destructive">{errorText || "Group not found"}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => navigate("/messages", { replace: true })}>
            Back to Messages
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }

  const groupName = String((group as any)?.name || "");

  return (
    <>
      <GroupChatWindow group={group} onOpenSettings={openSettings} />

      {showSettings ? (
  <div
    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"
    style={{ paddingBottom: "6rem" }} // lifts modal above bottom nav
    onClick={() => setShowSettings(false)}
  >
     <div
       className="w-full max-w-lg rounded-xl bg-background border shadow-lg p-4 translate-y-[-2rem]"
       onClick={(e) => e.stopPropagation()}
     >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {t("groupSettings.title", { defaultValue: "Group settings" })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("groupSettings.roleLabel", { defaultValue: "Your role" })}:{" "}
                  {myRole ? myRole : t("groupSettings.roleUnknown", { defaultValue: "unknown" })}
                </div>
              </div>

              <Button variant="ghost" onClick={() => setShowSettings(false)}>
                {t("actions.close", { defaultValue: "Close" })}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Rename (admin only) */}
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">
                  {t("groupSettings.groupName", { defaultValue: "Group name" })}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={groupName || "Group name"}
                    disabled={!isAdmin || savingName}
                  />
                  <Button
                    onClick={() => void handleRename()}
                    disabled={!isAdmin || savingName || !renameValue.trim() || renameValue.trim() === groupName.trim()}
                  >
                    {savingName
                      ? t("actions.saving", { defaultValue: "Saving..." })
                      : t("actions.save", { defaultValue: "Save" })}
                  </Button>
                </div>
                {!isAdmin ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t("groupSettings.adminOnly", { defaultValue: "Only admins can rename the group." })}
                  </div>
                ) : null}
              </div>

              {/* Members */}
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {t("groupSettings.members", { defaultValue: "Members" })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadSettings()}
                    disabled={loadingSettings}
                  >
                    {t("actions.refresh", { defaultValue: "Refresh" })}
                  </Button>
                </div>

                {loadingSettings ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("states.loading", { defaultValue: "Loading..." })}
                  </div>
                ) : members.length === 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {t("groupSettings.noMembers", { defaultValue: "No members found." })}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {members.map((m) => (
                      <div key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate">{memberName(m)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("groupSettings.roleLabel", { defaultValue: "Role" })}:{" "}
                            {m.role || "member"}
                          </div>
                        </div>
                        {m.user_id === me ? (
                          <div className="text-xs text-muted-foreground">
                            {t("groupSettings.you", { defaultValue: "You" })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Errors */}
              {settingsError ? (
                <div className="text-sm text-destructive">{settingsError}</div>
              ) : null}

              {/* Leave group */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="destructive"
                  onClick={() => void handleLeaveGroup()}
                  disabled={leaving}
                >
                  {leaving
                    ? t("groupSettings.leaving", { defaultValue: "Leaving..." })
                    : t("groupSettings.leave", { defaultValue: "Leave group" })}

                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}