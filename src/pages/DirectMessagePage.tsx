import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PrivateChatWindow from "@/components/PrivateChatWindow";

type Conversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

export default function DirectMessagePage() {
  const { otherUserId } = useParams();
  const { user } = useAuth();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!user?.id || !otherUserId) return;

      setLoading(true);

      const ids = [user.id, otherUserId].sort();
      const conversationId = `dm:${ids[0]}:${ids[1]}`;

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("user_id", otherUserId)
        .maybeSingle();

      const name = (prof?.full_name || prof?.username || "User") as string;

      if (!alive) return;

      setConv({
        id: conversationId,
        otherUserId,
        otherUserName: name,
        otherUserAvatar: prof?.avatar_url || undefined,
        unreadCount: 0,
      });

      setLoading(false);
    }

    void run();

    return () => {
      alive = false;
    };
  }, [user?.id, otherUserId]);

  if (loading || !conv) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">
          Opening chat...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      <PrivateChatWindow conversation={conv} />
    </div>
  );
}