import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

type Conversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

function fmtTime(ts?: string) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString() === new Date().toLocaleDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString();
  } catch {
    return "";
  }
}

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  const s = parts.map((p) => p[0]?.toUpperCase()).join("");
  return s || "U";
}

export default function ConversationsList(props: {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (c: Conversation) => void;
}) {
  const { conversations, selectedConversation } = props;

  const selectedId = selectedConversation?.id ?? "";
  const list = useMemo(() => conversations || [], [conversations]);

  const { isOnline } = useOnlineUsers();
  const navigate = useNavigate();

  const openDM = (otherUserId: string) => {
    navigate(`/messages/${otherUserId}`);
  };

  return (
    <div className="flex-1 overflow-auto">
      {list.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          No conversations yet.
        </div>
      ) : (
        <div className="divide-y">
          {list.map((c) => {
            const active = c.id === selectedId;
            const online = isOnline(c.otherUserId);

            return (
              <button
                key={c.id}
                onClick={() => openDM(c.otherUserId)}
                className={`w-full text-left px-3 py-3 flex gap-3 items-center hover:bg-accent/40 ${
                  active ? "bg-accent/50" : ""
                }`}
              >
                {/* Avatar + presence */}
                <div className="relative h-10 w-10 shrink-0">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {c.otherUserAvatar ? (
                      <img
                        src={c.otherUserAvatar}
                        alt=""
                        className="h-10 w-10 object-cover"
                      />
                    ) : (
                      <div className="text-xs font-semibold text-muted-foreground">
                        {initials(c.otherUserName)}
                      </div>
                    )}
                  </div>

                  {/* Presence indicator */}
                  <span
                    className={[
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full",
                      online
                        ? "bg-green-500"
                        : "border-2 border-gray-400 bg-background",
                    ].join(" ")}
                    title={online ? "Online" : "Offline"}
                    aria-label={online ? "Online" : "Offline"}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">
                      {c.otherUserName || "User"}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {fmtTime(c.lastMessageAt)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground truncate">
                      {c.lastMessage || ""}
                    </div>

                    {c.unreadCount > 0 ? (
                      <div className="ml-2 h-5 min-w-5 px-2 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}