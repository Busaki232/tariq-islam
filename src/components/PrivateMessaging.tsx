import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useUserConnections, type PendingRequest } from "@/hooks/useUserConnections";
import { useToast } from "@/hooks/use-toast";
import { useUserGroups } from "@/hooks/useUserGroups";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Check,
  Inbox,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { UserDirectory } from "@/components/UserDirectory";
import { useTranslation } from "react-i18next";
import Chat from "@/pages/Chat";



type ConnectedUser = {
  user_id: string;
  full_name: string | null;
  location?: string | null;
  avatar_url: string | null;
};

function safeName(name: string | null | undefined, fallback: string) {
  const n = (name || "").trim();
  return n || fallback;
}

export default function PrivateMessaging() {
  const { t } = useTranslation("privateChat");

  const { user } = useAuth();
  const userId = user?.id ?? "";

  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<"direct" | "community" | "groups" | "requests">("direct");

  const [showDirectory, setShowDirectory] = useState(false);
  const [messagePreview, setMessagePreview] = useState<Record<string, any>>({});

  const connections = useUserConnections();
  const {
    connectedUsers = [],
    pendingReceived = [],
    pendingSent = [],
    counts,
    loading: loadingConnections,
    errorText: connectionsError,
    reload: reloadConnections,
    acceptRequest,
    declineRequest,
cancelSentRequest,
} = connections;
const { groups = [], loading: loadingGroups, errorText: groupsError, reload: reloadGroups } =
  useUserGroups();
  const directList = useMemo(() => (connectedUsers || []) as ConnectedUser[], [connectedUsers]);

  const openChat = (otherUserId: string) => {
    if (!userId || !otherUserId) return;
    navigate(`/messages/${otherUserId}`);
  };

  const openGroup = (groupId: string) => {
    if (!userId || !groupId) return;
    navigate(`/messages/groups/${groupId}`);
  };

const onPickUser = (otherUserId: string, otherUserName: string) => {
    setShowDirectory(false);

    toast({
      title: t("toast.requestSentTitle", { defaultValue: "Request sent" }),
      description: t("toast.requestSentDesc", {
        otherUserName,
        defaultValue: "Sent request to {{otherUserName}}. They must accept before you can chat.",
      }),
    });

    // IMPORTANT: UserDirectory should call connections.sendRequest internally.
    // If it doesn't, we’ll fix UserDirectory next (see note at bottom).
  };

  const unknownUser = t("labels.unknownUser", { defaultValue: "Unknown User" });

  async function handleAccept(req: PendingRequest) {
    try {
      await acceptRequest(req.id);
      toast({
        title: t("toast.acceptedTitle", { defaultValue: "Request accepted" }),
        description: t("toast.acceptedDesc", {
          defaultValue: "You are now connected and can message each other.",
        }),
      });
    } catch (e: any) {
      toast({
        title: t("toast.errorTitle", { defaultValue: "Error" }),
        description: e?.message || "Failed to accept request",
        variant: "destructive",
      });
    }
  }

  async function handleDecline(req: PendingRequest) {
    try {
      await declineRequest(req.id);
      toast({
        title: t("toast.declinedTitle", { defaultValue: "Request declined" }),
      });
    } catch (e: any) {
      toast({
        title: t("toast.errorTitle", { defaultValue: "Error" }),
        description: e?.message || "Failed to decline request",
        variant: "destructive",
      });
    }
  }

  async function handleCancelSent(req: PendingRequest) {
    try {
      await cancelSentRequest(req.id);
      toast({
        title: t("toast.cancelledTitle", { defaultValue: "Request cancelled" }),
      });
    } catch (e: any) {
      toast({
        title: t("toast.errorTitle", { defaultValue: "Error" }),
        description: e?.message || "Failed to cancel request",
        variant: "destructive",
      });
    }
  }
useEffect(() => {
  if (!userId || directList.length === 0) return;

  let alive = true;

  const loadPreviews = async () => {
    const previews: Record<string, any> = {};

    await Promise.all(
      directList.map(async (p) => {
        const otherId = p.user_id;
        if (!otherId) return;

        const baseSelect =
          "id, sender_id, recipient_id, content, created_at, is_deleted, read_by, hidden_after";

        const sentQ = supabase
          .from("messages")
          .select(baseSelect)
          .eq("sender_id", userId)
          .eq("recipient_id", otherId)
          .neq("is_deleted", true as any)
          .order("created_at", { ascending: false })
          .limit(50);

        const recvQ = supabase
          .from("messages")
          .select(baseSelect)
          .eq("sender_id", otherId)
          .eq("recipient_id", userId)
          .neq("is_deleted", true as any)
          .order("created_at", { ascending: false })
          .limit(50);

        const [sentRes, recvRes] = await Promise.all([sentQ, recvQ]);

        if (sentRes.error) console.error("[Preview sent error]", sentRes.error);
        if (recvRes.error) console.error("[Preview recv error]", recvRes.error);

        const rows = [...(sentRes.data || []), ...(recvRes.data || [])].sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        const last = rows[0];

        const unread = rows.filter((m: any) => {
          if (m.sender_id === userId) return false;

          const readBy = m.read_by;
          if (!readBy) return true;
          if (Array.isArray(readBy)) return !readBy.includes(userId);
          if (typeof readBy === "object") return !readBy[userId];

          return true;
        }).length;

        previews[otherId] = {
          lastMessage: last?.content?.trim() || p.location || "No messages yet",
          lastMessageAt: last?.created_at || null,
          unread,
        };
      })
    );

    if (alive) setMessagePreview(previews);
  };

  void loadPreviews();

  return () => {
    alive = false;
  };
}, [userId, directList]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-muted/30">
      {/* Messages header */}
      <div className="shrink-0 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("title", { defaultValue: "Messages" })}
            </h1>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("subtitle", {
                defaultValue: "Chat, connect, and stay in touch",
              })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                void reloadConnections();
                void reloadGroups();
              }}
              disabled={!userId || loadingConnections || loadingGroups}
              aria-label={t("actions.refresh", {
                defaultValue: "Refresh",
              })}
              title={t("actions.refresh", {
                defaultValue: "Refresh",
              })}
              className="h-10 w-10 rounded-full"
            >
              <RefreshCw
                className={
                  loadingConnections || loadingGroups
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigate("/calls")}
              aria-label={t("actions.calls", {
                defaultValue: "Calls",
              })}
              title={t("actions.calls", {
                defaultValue: "Calls",
              })}
              className="h-10 w-10 rounded-full"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowDirectory(true)}
            className="h-11 gap-2 rounded-xl"
          >
            <MessageCircle className="h-4 w-4" />
            {t("actions.newChat", {
              defaultValue: "New Chat",
            })}
          </Button>

          <Button
            type="button"
            onClick={() => navigate("/groups/new")}
            className="h-11 gap-2 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            {t("actions.newGroup", {
              defaultValue: "New Group",
            })}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as any)}>
          <TabsList className="mt-4 grid h-auto w-full grid-cols-4 rounded-xl bg-muted p-1">
            <TabsTrigger
              value="direct"
              className="rounded-lg px-1 py-2 text-xs sm:text-sm"
            >
              {t("tabs.direct", {
                count: directList.length,
                defaultValue: "Chats",
              })}
            </TabsTrigger>

            <TabsTrigger
              value="community"
              className="rounded-lg px-1 py-2 text-xs sm:text-sm"
            >
              {t("tabs.community", {
                defaultValue: "Community",
              })}
            </TabsTrigger>

            <TabsTrigger
              value="groups"
              className="rounded-lg px-1 py-2 text-xs sm:text-sm"
            >
              {t("tabs.groups", {
                defaultValue: "Groups",
              })}
            </TabsTrigger>

            <TabsTrigger
              value="requests"
              className="relative rounded-lg px-1 py-2 text-xs sm:text-sm"
            >
              {t("tabs.requests", {
                defaultValue: "Requests",
              })}

              {counts?.pendingReceived ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {counts.pendingReceived}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Single-pane content */}
      <div className="flex-1 min-h-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          {/* DIRECT */}
          <TabsContent value="direct" className="h-full m-0">
            <ScrollArea className="h-full">
              {loadingConnections ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("states.loading", { defaultValue: "Loading..." })}
                </div>
              ) : connectionsError ? (
                <div className="p-4">
                  <div className="text-sm text-destructive">{connectionsError}</div>
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => void reloadConnections()}>
                      {t("actions.retry", { defaultValue: "Retry" })}
                    </Button>
                  </div>
                </div>
              ) : directList.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <div className="text-sm text-muted-foreground">
                    {t("empty.title", { defaultValue: "No connected users yet" })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {t("empty.desc", {
                      defaultValue:
                        "Tap New Chat to send a request. They must accept before you can message.",
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="secondary" onClick={() => setShowDirectory(true)}>
                      {t("actions.findUsers", { defaultValue: "Find users" })}
                    </Button>
                    <Button variant="outline" onClick={() => setTab("requests")}>
                      <Inbox className="h-4 w-4 mr-2" />
                      {t("actions.viewRequests", { defaultValue: "View requests" })}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {directList.map((p) => {
                    const name = safeName(p.full_name, unknownUser);
                    return (
                      <button
                        key={p.user_id}
                        type="button"
                        onClick={() => openChat(p.user_id)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                       <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10">
                           <AvatarImage src={p.avatar_url || ""} alt={name} />
                           <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                         </Avatar>

                         <div className="flex-1 min-w-0">
                           <div className="font-medium truncate">{name}</div>
                           <div className="text-sm text-muted-foreground truncate">
                             {messagePreview[p.user_id]?.lastMessage || p.location || "No messages yet"}
                           </div>
                         </div>

                         <div className="flex flex-col items-end gap-1">
                           {messagePreview[p.user_id]?.lastMessageAt && (
                             <div className="text-xs text-muted-foreground">
                               {new Date(
                                 messagePreview[p.user_id].lastMessageAt
                               ).toLocaleTimeString([], {
                                 hour: "numeric",
                                 minute: "2-digit",
                               })}
                             </div>
                           )}

                           {messagePreview[p.user_id]?.unread > 0 && (
                             <span className="min-w-[20px] h-[20px] rounded-full bg-green-600 text-white text-[11px] flex items-center justify-center px-1">
                               {messagePreview[p.user_id].unread}
                             </span>
                           )}
                         </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* COMMUNITY */}
          <TabsContent value="community" className="h-full m-0">
            <div className="h-full overflow-y-auto">
              <Chat />
            </div>
          </TabsContent>

          {/* GROUPS */}
          <TabsContent value="groups" className="h-full m-0">
            <ScrollArea className="h-full">
              {loadingGroups ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : groupsError ? (
                <div className="p-4">
                  <div className="text-sm text-destructive">{groupsError}</div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" onClick={() => void reloadGroups()}>
                      {t("actions.retry", { defaultValue: "Retry" })}
                    </Button>
                    <Button onClick={() => navigate("/groups/new")}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("actions.newGroup", { defaultValue: "New Group" })}
                    </Button>
                  </div>
                </div>
              ) : groups.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <div className="text-sm text-muted-foreground">
                    {t("groups.placeholder", { defaultValue: "Groups list goes here." })}
                  </div>
                  <div className="mt-4">
                    <Button type="button" onClick={() => navigate("/groups/new")}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("actions.newGroup", { defaultValue: "New Group" })}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => openGroup(g.id)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-medium truncate">{g.name || "Group"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(g.created_at).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* REQUESTS */}
          <TabsContent value="requests" className="h-full m-0">
            <ScrollArea className="h-full">
              {loadingConnections ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {t("states.loading", { defaultValue: "Loading..." })}
                </div>
              ) : connectionsError ? (
                <div className="p-4">
                  <div className="text-sm text-destructive">{connectionsError}</div>
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => void reloadConnections()}>
                      {t("actions.retry", { defaultValue: "Retry" })}
                    </Button>
                  </div>
                </div>
              ) : pendingReceived.length === 0 && pendingSent.length === 0 ? (
                <div className="p-10 text-center">
                  <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <div className="text-sm text-muted-foreground">
                    {t("requests.empty", { defaultValue: "No pending requests." })}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-6">
                  {/* Incoming */}
                  <div>
                    <div className="font-semibold mb-2">
                      {t("requests.incoming", { defaultValue: "Incoming" })}
                    </div>

                    {pendingReceived.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t("requests.noneIncoming", { defaultValue: "No incoming requests." })}
                      </div>
                    ) : (
                      <div className="divide-y rounded-lg border overflow-hidden">
                        {pendingReceived.map((req) => {
                          const name = safeName(req.other.full_name, unknownUser);
                          return (
                            <div key={req.id} className="px-3 py-3 flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={req.other.avatar_url || ""} alt={name} />
                                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {req.other.location || " "}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button size="sm" className="gap-2" onClick={() => void handleAccept(req)}>
                                  <Check className="h-4 w-4" />
                                  {t("requests.accept", { defaultValue: "Accept" })}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => void handleDecline(req)}
                                >
                                  <X className="h-4 w-4" />
                                  {t("requests.decline", { defaultValue: "Decline" })}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sent */}
                  <div>
                    <div className="font-semibold mb-2">
                      {t("requests.sent", { defaultValue: "Sent" })}
                    </div>

                    {pendingSent.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t("requests.noneSent", { defaultValue: "No sent requests." })}
                      </div>
                    ) : (
                      <div className="divide-y rounded-lg border overflow-hidden">
                      {pendingSent.map((req) => {
                        const other = (req as any)?.other;
                        const name = safeName(other?.full_name, unknownUser);
                        return (
                            <div key={req.id} className="px-3 py-3 flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={other?.avatar_url || ""} alt={name} />
                                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>

                          <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {t("requests.pending", { defaultValue: "Pending" })}
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleCancelSent(req)}
                              >
                                {t("requests.cancel", { defaultValue: "Cancel" })}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

 {/* User picker for New Chat */}
 {showDirectory ? (
   <div
   className={[
     "w-full max-w-lg rounded-xl bg-background border shadow-lg",
     "flex flex-col overflow-hidden",
     "max-h-[calc(100dvh-env(safe-area-inset-top)-9rem)] sm:max-h-[calc(100dvh-6rem)]",
   ].join(" ")}

     onClick={() => setShowDirectory(false)}
   >
     <div
       className={[
         "w-full max-w-lg rounded-xl bg-background border shadow-lg",
         "flex flex-col",
         "max-h-[calc(100dvh-8rem)] sm:max-h-[calc(100dvh-6rem)]",
       ].join(" ")}
       onClick={(e) => e.stopPropagation()}
     >
       <div className="shrink-0 p-4 pb-3 border-b">
         <div className="flex items-center justify-between">
           <div className="font-semibold">
             {t("modal.title", { defaultValue: "Start a new chat" })}
           </div>

           <button
             type="button"
             onClick={() => setShowDirectory(false)}
             className="text-sm text-muted-foreground hover:underline"
           >
             {t("actions.close", { defaultValue: "Close" })}
           </button>
         </div>
       </div>

       <ScrollArea className="flex-1 min-h-0">
         <div className="p-4 pt-3">
           <UserDirectory
             onSelectUser={(id, name) => onPickUser(id, name)}
             onClose={() => setShowDirectory(false)}
           />
         </div>
       </ScrollArea>
     </div>
   </div>
 ) : null}
</div>
);
}