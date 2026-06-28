// src/components/UserDirectory.tsx
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

import {
  Search,
  MessageCircle,
  UserPlus,
  Clock,
  Check,
  X,
  Loader2,
  AtSign,
  Link as LinkIcon,
  Share2,
  QrCode,
  Copy,
} from "lucide-react";

type ProfileLite = {
  user_id: string;
  full_name: string | null;
  username?: string | null;
  location?: string | null;
  avatar_url: string | null;
};

interface UserDirectoryProps {
  onSelectUser: (userId: string, userName: string) => void;
  onClose: () => void;
}

function safeLower(v: unknown) {
  return typeof v === "string" ? v.toLowerCase() : "";
}

function normalizeUsername(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  return v.startsWith("@") ? v.slice(1).trim() : v;
}

function pickUserId(p: any): string {
  return (p?.user_id || p?.id || p?.profile?.user_id || "").toString();
}

function pickFullName(p: any): string {
  return (
    (p?.full_name ||
      p?.profile?.full_name ||
      p?.name ||
      p?.profile?.name ||
      "")?.toString() || ""
  );
}

function pickUsername(p: any): string {
  return ((p?.username || p?.profile?.username || "")?.toString() || "");
}

function pickLocation(p: any): string {
  return ((p?.location || p?.profile?.location || "")?.toString() || "");
}

function pickAvatar(p: any): string {
  return ((p?.avatar_url || p?.profile?.avatar_url || "")?.toString() || "");
}

async function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export const UserDirectory = ({ onSelectUser, onClose }: UserDirectoryProps) => {
  const { t } = useTranslation("privateChat");
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"connected" | "requests" | "directory">("connected");
  const [searchTerm, setSearchTerm] = useState("");

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);

  const [dirResults, setDirResults] = useState<ProfileLite[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);

  const [addingIds, setAddingIds] = useState<Record<string, boolean>>({});
  const [showQr, setShowQr] = useState(false);

  const {
    connectedUsers = [],
    pendingReceived = [],
    pendingSent = [],
    loading: loadingConnections,
    acceptConnectionRequest,
    rejectConnectionRequest,
    sendConnectionRequest,
    reload,
  } = useUserConnections();

  const connectedIdSet = useMemo(() => {
    const s = new Set<string>();
    (connectedUsers || []).forEach((p: any) => {
      const id = pickUserId(p);
      if (id) s.add(id);
    });
    return s;
  }, [connectedUsers]);

  const pendingSentSet = useMemo(() => {
    const s = new Set<string>();
    (pendingSent || []).forEach((r: any) => {
      const id = (r?.receiver_id || r?.profile?.receiver_id || "").toString();
      if (id) s.add(id);
    });
    return s;
  }, [pendingSent]);

  const pendingReceivedSet = useMemo(() => {
    const s = new Set<string>();
    (pendingReceived || []).forEach((r: any) => {
      const id = (r?.requester_id || r?.profile?.requester_id || "").toString();
      if (id) s.add(id);
    });
    return s;
  }, [pendingReceived]);

  const requesterIds = useMemo(() => {
    const ids = new Set<string>();
    (pendingReceived || []).forEach((r: any) => {
      const id = (r?.requester_id || "").toString();
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [pendingReceived]);

  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, ProfileLite>>({});
  const [loadingRequesters, setLoadingRequesters] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) return;
      if (requesterIds.length === 0) {
        setRequesterProfiles({});
        return;
      }

      setLoadingRequesters(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, location, avatar_url")
          .in("user_id", requesterIds)
          .limit(200);

        if (error) throw error;

        const map: Record<string, ProfileLite> = {};
        (data || []).forEach((p: any) => {
          if (p?.user_id) map[p.user_id] = p as ProfileLite;
        });

        if (!cancelled) setRequesterProfiles(map);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingRequesters(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, requesterIds.join("|")]);

  const visiblePresenceIds = useMemo(() => {
    const ids = new Set<string>();
    (connectedUsers || []).forEach((p: any) => {
      const id = pickUserId(p);
      if (id) ids.add(id);
    });
    (pendingReceived || []).forEach((r: any) => {
      const id = (r?.requester_id || "").toString();
      if (id) ids.add(id);
    });
    return Array.from(ids).slice(0, 200);
  }, [connectedUsers, pendingReceived]);

  const { hideOnline, setHideOnline } = useUserPresence(visiblePresenceIds);

  const displayName = (p?: Partial<ProfileLite> | null) => {
    const name = (p?.full_name || "").trim();
    return name || t("labels.unknownUser", { defaultValue: "Unknown User" });
  };

  const myDisplayName = useMemo(() => {
    const authName =
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      "";
    return authName.trim() || "A Tariq Islam user";
  }, [user]);

  const myUsername = useMemo(() => {
    const authUname = (user?.user_metadata?.username as string | undefined) || "";
    return authUname.trim();
  }, [user]);

const inviteLink = useMemo(() => {
        if (!user?.id) return "";
        const publicBase = "https://global-muslims-connect.com";
        const identifier = myUsername || user.id;
        return `${publicBase}/connect?u=${encodeURIComponent(identifier)}`;
}, [user?.id, myUsername]);

  const qrImageUrl = useMemo(() => {
    if (!inviteLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      inviteLink,
    )}`;
  }, [inviteLink]);

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: t("directory.linkCopiedTitle", { defaultValue: "Invite link copied" }),
        description: t("directory.linkCopiedDesc", {
          defaultValue: "Share it with a friend to connect quickly.",
        }),
      });
    } catch {
      toast({
        title: t("toast.errorTitle", { defaultValue: "Error" }),
        description: t("directory.linkCopyFailed", {
          defaultValue: "Could not copy invite link.",
        }),
        variant: "destructive",
      });
    }
  }

  async function shareInviteLink() {
    if (!inviteLink) return;

    const title = t("directory.shareTitle", {
      defaultValue: "Connect with me on Tariq Islam",
    });
    const text = t("directory.shareText", {
      defaultValue: "{{name}} invited you to connect on Tariq Islam.",
      name: myDisplayName,
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: inviteLink,
        });
      } else {
        await navigator.clipboard.writeText(inviteLink);
        toast({
          title: t("directory.linkCopiedTitle", { defaultValue: "Invite link copied" }),
          description: t("directory.shareFallbackDesc", {
            defaultValue: "Sharing is not available here, so the link was copied instead.",
          }),
        });
      }
    } catch {
      // user cancelled or share failed
    }
  }

  const filteredConnectedUsers = useMemo(() => {
    const q = safeLower(searchTerm);
    return (connectedUsers || []).filter((p: any) => {
      const name = safeLower(pickFullName(p));
      const uname = safeLower(pickUsername(p));
      const loc = safeLower(pickLocation(p));
      return name.includes(q) || uname.includes(q) || loc.includes(q);
    });
  }, [connectedUsers, searchTerm]);

  const filteredPendingReceived = useMemo(() => {
    const q = safeLower(searchTerm);
    return (pendingReceived || []).filter((r: any) => {
      const rid = (r?.requester_id || "").toString();
      const prof = rid ? requesterProfiles[rid] : null;
      if (!prof) return q.length === 0;
      const name = safeLower(prof.full_name);
      const uname = safeLower(prof.username);
      const loc = safeLower(prof.location);
      return name.includes(q) || uname.includes(q) || loc.includes(q);
    });
  }, [pendingReceived, requesterProfiles, searchTerm]);

  const handleInviteByUsername = async () => {
    if (!user?.id) {
      toast({ title: t("toast.signInRequired", { defaultValue: "Sign in required" }) });
      return;
    }

    const uname = normalizeUsername(inviteUsername);
    if (!uname) {
      toast({
        title: t("toast.enterUsernameTitle", { defaultValue: "Enter a username" }),
        description: t("toast.enterUsernameDesc", {
          defaultValue: "Please enter a username to invite.",
        }),
        variant: "destructive",
      });
      return;
    }

    if (inviting) return;
    setInviting(true);

    try {
      const { data: prof, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("user_id, full_name, username, location, avatar_url")
          .eq("username", uname)
          .maybeSingle(),
        12000,
      );

      if (error) throw error;

      if (!prof?.user_id) {
        toast({
          title: t("toast.userNotFoundTitle", { defaultValue: "User not found" }),
          description: t("toast.userNotFoundDesc", {
            uname,
            defaultValue: "No user found for @{{uname}}.",
          }),
          variant: "destructive",
        });
        return;
      }

      if (prof.user_id === user.id) {
        toast({
          title: t("toast.thatsYouTitle", { defaultValue: "That’s you" }),
          description: t("toast.cantInviteSelf", {
            defaultValue: "You can’t invite yourself.",
          }),
          variant: "destructive",
        });
        return;
      }

      if (connectedIdSet.has(prof.user_id)) {
        toast({
          title: t("toast.alreadyConnectedTitle", { defaultValue: "Already connected" }),
          description: t("toast.alreadyConnectedDesc", {
            defaultValue: "You are already connected with this user.",
          }),
        });
        return;
      }

      if (pendingSentSet.has(prof.user_id)) {
        toast({
          title: t("toast.requestAlreadySentTitle", { defaultValue: "Request already sent" }),
          description: t("toast.requestAlreadySentDesc", {
            defaultValue: "You already sent this user a request.",
          }),
        });
        return;
      }

      if (pendingReceivedSet.has(prof.user_id)) {
        toast({
          title: t("toast.theyRequestedYouTitle", { defaultValue: "They already requested you" }),
          description: t("toast.checkRequestsTab", {
            defaultValue: "Check the Requests tab.",
          }),
        });
        return;
      }

      await withTimeout(sendConnectionRequest(prof.user_id), 12000);

const { data, error: notificationError } = await supabase
  .from("notifications")
  .insert({
    user_id: targetUserId,
    actor_id: user.id,
    type: "follow_request",
    title: `${name || "Someone"} sent you a follow request`,
    body: "Tap to view pending requests.",
  })
  .select();

console.log("Notification insert result:", data, notificationError);

      toast({
        title: t("toast.inviteSentTitle", { defaultValue: "Invite sent" }),
        description: t("toast.inviteSentDesc", {
          uname,
          defaultValue: "Invite sent to @{{uname}}.",
        }),
      });

      setInviteUsername("");
      await reload?.();
    } catch {
      toast({
        title: t("toast.couldNotSendInviteTitle", { defaultValue: "Could not send invite" }),
        description: t("toast.couldNotSendInviteDesc", {
          defaultValue: "Please try again.",
        }),
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleAddUser = async (e: MouseEvent, targetUserId: string, name: string) => {
    e.stopPropagation();
    if (!user?.id) {
      toast({
        title: t("toast.signInRequired", { defaultValue: "Sign in required" }),
        variant: "destructive",
      });
      return;
    }
    if (!targetUserId) return;

    if (addingIds[targetUserId]) return;
    setAddingIds((m) => ({ ...m, [targetUserId]: true }));

    try {
      await withTimeout(sendConnectionRequest(targetUserId), 12000);
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        actor_id: user.id,
        type: "follow_request",
        title: `${name || "Someone"} sent you a follow request`,
        body: "Tap to view pending requests.",
      });

      toast({
        title: t("toast.requestSentTitle", { defaultValue: "Request sent" }),
        description: t("toast.requestSentToName", {
          name,
          defaultValue: "Sent a request to {{name}}.",
        }),
      });
      await reload?.();
    } catch {
      toast({
        title: t("toast.couldNotSendRequestTitle", {
          defaultValue: "Could not send request",
        }),
        description: t("toast.couldNotSendRequestDesc", {
          defaultValue: "Please try again.",
        }),
        variant: "destructive",
      });
    } finally {
      setAddingIds((m) => {
        const next = { ...m };
        delete next[targetUserId];
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setDirError(null);

      if (activeTab !== "directory") {
        setDirLoading(false);
        setDirError(null);
        setDirResults([]);
        return;
      }

      if (!user?.id) {
        setDirResults([]);
        setDirLoading(false);
        setDirError(
          t("directory.signInToSearch", { defaultValue: "Sign in to search users." }),
        );
        return;
      }

      setDirLoading(true);

      try {
        const q = searchTerm.trim();
        let query = supabase
          .from("profiles")
          .select("user_id, full_name, username, location, avatar_url")
          .neq("user_id", user.id)
          .limit(50);

        if (q.length >= 1) {
          const like = `%${q}%`;
          query = query.or(
            `username.ilike.${like},full_name.ilike.${like},location.ilike.${like}`,
          );
        } else {
          query = query.order("updated_at", { ascending: false });
        }

        const { data, error } = await withTimeout(query, 12000);

        if (error) throw error;

        const rows = (data || [])
          .filter((p: any) => p?.user_id && p.user_id !== user.id)
          .filter((p: any) => !connectedIdSet.has(p.user_id))
          .filter((p: any) => !pendingSentSet.has(p.user_id))
          .filter((p: any) => !pendingReceivedSet.has(p.user_id))
          .map((p: any) => p as ProfileLite);

        if (!cancelled) {
          setDirResults(rows);
          setDirError(null);
        }
      } catch {
        if (!cancelled) {
          setDirResults([]);
          setDirError(
            t("directory.searchFailed", {
              defaultValue: "Search failed. Please try again.",
            }),
          );
        }
      } finally {
        if (!cancelled) setDirLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    searchTerm,
    user?.id,
    connectedIdSet,
    pendingSentSet,
    pendingReceivedSet,
    t,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Invite area */}
      <div className="rounded-lg border bg-card/50 p-3 space-y-3">
        <div>
          <p className="text-sm font-medium">
            {t("directory.inviteTitle", { defaultValue: "Invite a friend" })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("directory.inviteDesc", {
              defaultValue: "Share your invite link, show your QR code, or invite by username.",
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => void copyInviteLink()}
            disabled={!inviteLink}
          >
            <Copy className="w-4 h-4" />
            {t("directory.copyLink", { defaultValue: "Copy Link" })}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => void shareInviteLink()}
            disabled={!inviteLink}
          >
            <Share2 className="w-4 h-4" />
            {t("directory.shareLink", { defaultValue: "Share" })}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => setShowQr(true)}
            disabled={!inviteLink}
          >
            <QrCode className="w-4 h-4" />
            {t("directory.showQr", { defaultValue: "Show QR" })}
          </Button>
        </div>

        <div className="rounded-md border bg-background/60 p-2 text-xs text-muted-foreground break-all">
          <div className="flex items-center gap-2 font-medium text-foreground mb-1">
            <LinkIcon className="w-3.5 h-3.5" />
            {t("directory.yourInviteLink", { defaultValue: "Your invite link" })}
          </div>
          {inviteLink ||
            t("directory.signInToGenerateLink", {
              defaultValue: "Sign in to generate your invite link.",
            })}
        </div>

        <div className="pt-1 border-t">
          <p className="text-xs font-medium mb-2">
            {t("directory.inviteByUsernameTitle", {
              defaultValue: "Invite by username",
            })}
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder={t("directory.invitePlaceholder", {
                  defaultValue: "Enter @username",
                })}
                className="pl-10"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleInviteByUsername();
                }}
              />
            </div>

            <Button
              type="button"
              onClick={() => void handleInviteByUsername()}
              disabled={inviting || !user?.id}
              className="gap-2"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {inviting
                ? t("directory.inviteBtnLoading", { defaultValue: "Sending..." })
                : t("directory.inviteBtn", { defaultValue: "Invite" })}
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={t("directory.searchPlaceholder", {
            defaultValue: "Search by username, name, or location",
          })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Online visibility */}
      <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {t("directory.onlineTitle", { defaultValue: "Online visibility" })}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {hideOnline
              ? t("directory.onlineHidden", { defaultValue: "Your online status is hidden" })
              : t("directory.onlineVisible", { defaultValue: "Your online status is visible" })}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setHideOnline((v) => !v)}
        >
          {hideOnline
            ? t("directory.showOnline", { defaultValue: "Show online" })
            : t("directory.hideOnline", { defaultValue: "Hide online" })}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connected">
            {t("directory.tabs.connected", {
              count: connectedUsers?.length || 0,
              defaultValue: "Connected ({{count}})",
            })}
          </TabsTrigger>

          <TabsTrigger value="requests">
            {t("directory.tabs.requests", { defaultValue: "Requests" })}
            {pendingReceived?.length > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 w-5 p-0 inline-flex items-center justify-center text-xs"
              >
                {pendingReceived.length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="directory">
            {t("directory.tabs.directory", { defaultValue: "Directory" })}
          </TabsTrigger>
        </TabsList>

        {/* CONNECTED */}
        <TabsContent value="connected" className="mt-4">
          <div className="overflow-y-auto max-h-[50vh]">
            {loadingConnections ? (
              <div className="p-4 text-sm text-muted-foreground">
                {t("states.loading", { defaultValue: "Loading..." })}
              </div>
            ) : filteredConnectedUsers.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchTerm
                    ? t("directory.noneConnectedMatch", { defaultValue: "No matching connections." })
                    : t("directory.noneConnected", { defaultValue: "No connected users yet." })}
                </p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredConnectedUsers.map((p: any) => {
                  const id = pickUserId(p);
                  const name = pickFullName(p).trim() || t("labels.unknownUser", { defaultValue: "Unknown User" });
                  const avatar = pickAvatar(p);
                  const uname = pickUsername(p);

                  return (
                    <div
                      key={id || name}
                      onClick={() => id && onSelectUser(id, name)}
                      className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Avatar>
                        <AvatarImage src={avatar || ""} alt={name} />
                        <AvatarFallback>{(name.charAt(0) || "?").toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {uname ? (
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              @{uname}
                            </span>
                          ) : null}
                        </div>
                        {pickLocation(p) ? (
                          <p className="text-sm text-muted-foreground truncate">
                            {pickLocation(p)}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        title={t("directory.message", { defaultValue: "Message" })}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* REQUESTS */}
        <TabsContent value="requests" className="mt-4">
          <div className="overflow-y-auto max-h-[50vh]">
            {loadingConnections || loadingRequesters ? (
              <div className="p-4 text-sm text-muted-foreground">
                {t("states.loading", { defaultValue: "Loading..." })}
              </div>
            ) : pendingReceived?.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {t("directory.noPending", { defaultValue: "No pending requests." })}
                </p>
              </div>
            ) : filteredPendingReceived.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {t("directory.noRequestsMatch", { defaultValue: "No matching requests." })}
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredPendingReceived.map((request: any) => {
                  const rid = (request?.requester_id || "").toString();
                  const prof = rid ? requesterProfiles[rid] : null;
                  const name = displayName(prof);

                  return (
                    <div
                      key={request.id}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border"
                    >
                      <Avatar>
                        <AvatarImage src={prof?.avatar_url || ""} alt={name} />
                        <AvatarFallback>{(name.charAt(0) || "?").toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="font-medium text-sm truncate">{name}</p>
                          {prof?.username ? (
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              @{prof.username}
                            </span>
                          ) : null}
                        </div>

                        {prof?.location ? (
                          <p className="text-xs text-muted-foreground truncate">{prof.location}</p>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          {t("directory.requestedOn", {
                            date: new Date(request.created_at).toLocaleDateString(),
                            defaultValue: "Requested on {{date}}",
                          })}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void acceptConnectionRequest(request.id);
                          }}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                          title={t("directory.accept", { defaultValue: "Accept" })}
                        >
                          <Check className="w-4 h-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void rejectConnectionRequest(request.id);
                          }}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title={t("directory.reject", { defaultValue: "Reject" })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("actions.close", { defaultValue: "Close" })}
            </Button>
          </div>
        </TabsContent>

        {/* DIRECTORY */}
        <TabsContent value="directory" className="mt-4">
          <div className="overflow-y-auto max-h-[50vh]">
            {dirLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                {t("directory.searching", { defaultValue: "Searching..." })}
              </div>
            ) : dirError ? (
              <div className="p-4 text-sm text-muted-foreground">{dirError}</div>
            ) : dirResults.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {t("directory.noUsersFound", { defaultValue: "No users found." })}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {dirResults.map((p) => {
                  const id = p.user_id;
                  const name = displayName(p);
                  const uname = (p.username || "").trim();
                  const busy = !!addingIds[id];

                  return (
                    <div
                      key={id}
                      className="flex items-center space-x-3 p-3 rounded-lg border bg-card/40"
                    >
                      <Avatar>
                        <AvatarImage src={p.avatar_url || ""} alt={name} />
                        <AvatarFallback>{(name.charAt(0) || "?").toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {uname ? (
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              @{uname}
                            </span>
                          ) : null}
                        </div>

                        {p.location ? (
                          <p className="text-xs text-muted-foreground truncate">{p.location}</p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => void handleAddUser(e as any, id, name)}
                        disabled={busy}
                        className="gap-2"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {busy
                          ? t("directory.adding", { defaultValue: "Adding..." })
                          : t("directory.add", { defaultValue: "Add" })}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("actions.close", { defaultValue: "Close" })}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR modal */}
      {showQr ? (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-background shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">
                {t("directory.qrTitle", { defaultValue: "My QR code" })}
              </div>
              <Button variant="ghost" onClick={() => setShowQr(false)}>
                {t("actions.close", { defaultValue: "Close" })}
              </Button>
            </div>

            <div className="rounded-lg border bg-white p-4 flex items-center justify-center">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={t("directory.qrAlt", { defaultValue: "Invite QR code" })}
                  className="w-[260px] h-[260px]"
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {t("directory.signInToGenerateLink", {
                    defaultValue: "Sign in to generate your invite link.",
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-muted-foreground break-all">{inviteLink}</div>

            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={() => void copyInviteLink()}
                disabled={!inviteLink}
              >
                <Copy className="w-4 h-4" />
                {t("directory.copyLink", { defaultValue: "Copy Link" })}
              </Button>

              <Button
                variant="secondary"
                className="flex-1 gap-2"
                onClick={() => void shareInviteLink()}
                disabled={!inviteLink}
              >
                <Share2 className="w-4 h-4" />
                {t("directory.shareLink", { defaultValue: "Share" })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};