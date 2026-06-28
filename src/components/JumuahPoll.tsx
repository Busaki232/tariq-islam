import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface JumuahPollProps {
  groupId: string;
  pollId: string;
  createdAt: string;
}

interface PollResponse {
  user_id: string;
  user_name: string;
  response: "going" | "not_going" | "maybe";
}

export const JumuahPoll = ({ groupId, pollId, createdAt }: JumuahPollProps) => {
    const { t } = useTranslation(["events", "common"]);
  const { user } = useAuth();
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [userResponse, setUserResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPollResponses();
  }, [pollId]);

  const loadPollResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("jumuah_poll_responses")
        .select("user_id, user_name, response")
        .eq("poll_id", pollId);

      if (error) throw error;

      const typedData = (data || []) as PollResponse[];
      setResponses(typedData);
      const myResponse = typedData.find((r) => r.user_id === user?.id);
      setUserResponse(myResponse?.response || null);
    } catch (error) {
      console.error("Error loading poll responses:", error);
    }
  };

  const handleResponse = async (response: "going" | "not_going" | "maybe") => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase
        .from("jumuah_poll_responses")
        .upsert({
          poll_id: pollId,
          user_id: user.id,
          user_name: profile?.full_name || "Unknown",
          response,
        } as any);

      if (error) throw error;

      setUserResponse(response);
      await loadPollResponses();
      toast.success("Response recorded!");
    } catch (error) {
      console.error("Error saving response:", error);
      toast.error("Failed to save response");
    } finally {
      setLoading(false);
    }
  };

  const goingCount = responses.filter((r) => r.response === "going").length;
  const maybeCount = responses.filter((r) => r.response === "maybe").length;

  return (
    <Card className="overflow-hidden border-islamic-green/30 bg-gradient-to-br from-background to-islamic-green/10">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-islamic-green/20">
          <Users className="h-5 w-5 text-islamic-green" />
          <div className="flex-1">
            <h4 className="font-semibold">
              {t("events:jumuahPoll.title", { defaultValue: "Who's going to Jumu'ah?" })}
            </h4>
            <p className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Response Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={userResponse === "going" ? "default" : "outline"}
            size="sm"
            onClick={() => handleResponse("going")}
            disabled={loading}
            className="gap-1"
          >
            {userResponse === "going" && <CheckCircle2 className="h-3 w-3" />}
            Going ({goingCount})
          </Button>
          <Button
            variant={userResponse === "maybe" ? "default" : "outline"}
            size="sm"
            onClick={() => handleResponse("maybe")}
            disabled={loading}
            className="gap-1"
          >
            {userResponse === "maybe" && <CheckCircle2 className="h-3 w-3" />}
            Maybe ({maybeCount})
          </Button>
          <Button
            variant={userResponse === "not_going" ? "default" : "outline"}
            size="sm"
            onClick={() => handleResponse("not_going")}
            disabled={loading}
          >
            {userResponse === "not_going" && <CheckCircle2 className="h-3 w-3" />}
            Not Going
          </Button>
        </div>

        {/* Going List */}
        {goingCount > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium mb-2">Going:</p>
            <div className="flex flex-wrap gap-2">
              {responses
                .filter((r) => r.response === "going")
                .map((r) => (
                  <div key={r.user_id} className="flex items-center gap-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {r.user_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{r.user_name}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
