import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserConnections } from "@/hooks/useUserConnections";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

type ConnectedUser = {
  user_id: string;
  full_name: string | null;
  username?: string | null;
  location?: string | null;
  avatar_url: string | null;
};

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // called after successful create
  onCreated?: (groupId: string) => void;
}

function safeName(name: string | null | undefined, fallback: string) {
  const n = (name || "").trim();
  return n || fallback;
}

async function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export default function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const { t } = useTranslation("privateChat");
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const {
    connectedUsers = [],
    loading: loadingConnections,
    reload: reloadConnections,
  } = useUserConnections();

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroupName("");
    setSearch("");
    setSelectedIds([]);
  }, [open]);

  const unknownUser = t("labels.unknownUser", { defaultValue: "Unknown User" });

  const filteredConnections = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    const list = (connectedUsers || []) as ConnectedUser[];
    if (!q) return list;

    return list.filter((p) => {
      const n = (p.full_name || "").toLowerCase();
      const u = (p.username || "").toLowerCase();
      const l = (p.location || "").toLowerCase();
      return n.includes(q) || u.includes(q) || l.includes(q);
    });
  }, [connectedUsers, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canCreate = userId && groupName.trim().length >= 2 && !creating;

  const handleCreate = async () => {
    if (!userId) return;

    const name = groupName.trim();
    if (name.length < 2) return;

    setCreating(true);
    try {
      // 1) create group
      // NOTE: using your table name from screenshot: chat_groups
      const groupRes = await withTimeout(
        supabase
          .from("chat_groups")
          .insert({
            name,
            group_type: "private",
            created_by: userId,
          })
          .select("id")
          .single(),
        12000
      );

      const groupId = (groupRes as any).data?.id as string | undefined;
      const groupErr = (groupRes as any).error;
      if (groupErr) throw groupErr;
      if (!groupId) throw new Error("Could not create group");

      // 2) add creator + selected members
      // table in screenshot: chat_group_members (or group_members). We’ll use chat_group_members first.
      const membersToAdd = Array.from(new Set([userId, ...selectedIds]));

      // Try chat_group_members, if your schema uses group_members instead, switch here.
      const memRes = await withTimeout(
        supabase.from("chat_group_members").insert(
          membersToAdd.map((uid) => ({
            group_id: groupId,
            user_id: uid,
            role: uid === userId ? "admin" : "member",
          }))
        ),
        12000
      );

      const memErr = (memRes as any).error;
      if (memErr) throw memErr;

      // optional: refresh connections/groups outside
      await reloadConnections?.();

      onOpenChange(false);

      // toast is optional, but keep it translated
      // if you prefer your shadcn toast, plug it in here
      // eslint-disable-next-line no-console
      console.log("[group] created:", groupId);

      onCreated?.(groupId);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[CreateGroupDialog] create failed", e);
      alert(
        t("createGroup.errors.createFailed", {
          defaultValue: "Could not create group. Please try again.",
        })
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("createGroup.title", { defaultValue: "Create new group" })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name */}
          <div className="space-y-1.5">
            <div className="text-sm font-medium">
              {t("createGroup.groupNameLabel", { defaultValue: "Group name" })}
            </div>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("createGroup.groupNamePlaceholder", {
                defaultValue: "Example: Lagos Brothers",
              })}
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Members */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {t("createGroup.addMembersOptional", { defaultValue: "Add members now (optional)" })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("createGroup.selectedCount", {
                defaultValue: "Selected: {{count}}",
                count: selectedIds.length,
              })}
            </div>
          </div>

          <div className="relative">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("createGroup.searchConnections", {
                defaultValue: "Search your connections...",
              })}
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[260px]">
              {loadingConnections ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("states.loading", { defaultValue: "Loading..." })}
                </div>
              ) : filteredConnections.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {search.trim()
                    ? t("createGroup.noMatches", { defaultValue: "No matches" })
                    : t("createGroup.noConnections", { defaultValue: "No connections yet" })}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConnections.map((p) => {
                    const name = safeName(p.full_name, unknownUser);
                    const checked = selectedIds.includes(p.user_id);

                    return (
                      <button
                        key={p.user_id}
                        type="button"
                        onClick={() => toggle(p.user_id)}
                        className="w-full text-left px-3 py-3 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={checked} onCheckedChange={() => toggle(p.user_id)} />

                          <Avatar className="h-10 w-10">
                            <AvatarImage src={p.avatar_url || ""} alt={name} />
                            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.username ? `@${p.username}` : " "}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              {t("actions.close", { defaultValue: "Close" })}
            </Button>

            <Button type="button" onClick={() => void handleCreate()} disabled={!canCreate}>
              {creating
                ? t("createGroup.creating", { defaultValue: "Creating..." })
                : t("createGroup.createBtn", { defaultValue: "Create group" })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}