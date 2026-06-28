import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Checkbox } from "./ui/checkbox";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Group } from "@/hooks/useUserGroups";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useTranslation } from "react-i18next";

interface UserProfile {
  user_id: string;
  full_name: string;
  location?: string;
  avatar_url?: string;
}

interface AddGroupMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  onMembersAdded?: () => void;
}

const AddGroupMembersDialog = ({
  open,
  onOpenChange,
  group,
  onMembersAdded,
}: AddGroupMembersDialogProps) => {
  const { t } = useTranslation("privateChat");
  const { user } = useAuth();
  const { members, addMembers } = useGroupMembers(group.id);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const existingMemberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  useEffect(() => {
    if (!open) return;

    setSelectedUserIds([]);
    setSearchTerm("");
    void loadUsers();
    // Reload when members list changes while dialog is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, existingMemberIds.length]);

  const loadUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_all_public_profiles");
      if (error) throw error;

      const availableUsers = (data || [])
        .filter(
          (profile: any) =>
            profile.user_id !== user.id && !existingMemberIds.includes(profile.user_id)
        )
        .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

      setUsers(availableUsers);
    } catch (error) {
      logger.error("Error loading users", error);
      toast.error(t("groups.addMembers.loadUsersFailed", { defaultValue: "Failed to load users" }));
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const s = (searchTerm || "").trim().toLowerCase();
    if (!s) return users;

    return users.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const loc = (u.location || "").toLowerCase();
      return name.includes(s) || loc.includes(s);
    });
  }, [users, searchTerm]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error(
        t("groups.addMembers.selectAtLeastOne", { defaultValue: "Please select at least one user" })
      );
      return;
    }

    setAdding(true);
    try {
      const result = await addMembers(selectedUserIds);

      if (result.success) {
        toast.success(
          t("groups.addMembers.addedSuccess", {
            defaultValue: "Added {{count}} member(s) successfully",
            count: selectedUserIds.length,
          })
        );
        onMembersAdded?.();
        onOpenChange(false);
        setSelectedUserIds([]);
      }
    } catch (error: any) {
      logger.error("Error adding members", error);
      toast.error(
        error?.message ||
          t("groups.addMembers.addFailed", { defaultValue: "Failed to add members" })
      );
    } finally {
      setAdding(false);
    }
  };

  const titleText = t("groups.addMembers.title", {
    defaultValue: "Add Members to {{groupName}}",
    groupName: group.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("groups.addMembers.searchPlaceholder", { defaultValue: "Search users..." })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto min-h-[400px] border rounded-lg p-2">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm
                  ? t("groups.addMembers.noUsersFound", { defaultValue: "No users found" })
                  : t("groups.addMembers.noAvailableUsers", {
                      defaultValue: "No available users to add",
                    })}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((userProfile) => {
                const isExistingMember = existingMemberIds.includes(userProfile.user_id);
                const isSelected = selectedUserIds.includes(userProfile.user_id);

                return (
                  <div
                    key={userProfile.user_id}
                    onClick={() =>
                      !isExistingMember && toggleUserSelection(userProfile.user_id)
                    }
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isExistingMember
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-muted/50"
                    }`}
                  >
                    {!isExistingMember && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUserSelection(userProfile.user_id)}
                        className="shrink-0"
                      />
                    )}

                    <Avatar className="shrink-0">
                      <AvatarImage src={userProfile.avatar_url} alt={userProfile.full_name} />
                      <AvatarFallback>
                        {(userProfile.full_name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {userProfile.full_name ||
                          t("labels.unknownUser", { defaultValue: "Unknown User" })}
                        {isExistingMember ? (
                          <span className="text-muted-foreground ml-2">
                            (
                            {t("groups.addMembers.alreadyMember", {
                              defaultValue: "Already a member",
                            })}
                            )
                          </span>
                        ) : null}
                      </p>
                      {userProfile.location ? (
                        <p className="text-sm text-muted-foreground truncate">
                          {userProfile.location}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedUserIds.length > 0
              ? t("groups.addMembers.selectedCount", {
                  defaultValue: "Selected: {{count}} user{{plural}}",
                  count: selectedUserIds.length,
                  plural: selectedUserIds.length > 1 ? "s" : "",
                }).replace("{{plural}}", selectedUserIds.length > 1 ? "s" : "")
              : ""}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
              {t("actions.cancel", { defaultValue: "Cancel" })}
            </Button>

            <Button
              onClick={handleAddMembers}
              disabled={adding || selectedUserIds.length === 0}
              className="gap-2"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("groups.addMembers.adding", { defaultValue: "Adding..." })}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t("groups.addMembers.addSelected", {
                    defaultValue: "Add Selected Members",
                  })}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddGroupMembersDialog;