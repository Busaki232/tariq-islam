import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MessageReactionsProps {
  messageId: string;
  reactions: Record<string, string[]>; // { emoji: [userId1, userId2, ...] }
  onReactionUpdate?: () => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👏"];

export const MessageReactions = ({ messageId, reactions = {}, onReactionUpdate }: MessageReactionsProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    try {
      const currentReactions = { ...reactions };
      const userReactions = currentReactions[emoji] || [];
      
      // Toggle reaction
      if (userReactions.includes(user.id)) {
        // Remove reaction
        currentReactions[emoji] = userReactions.filter(id => id !== user.id);
        if (currentReactions[emoji].length === 0) {
          delete currentReactions[emoji];
        }
      } else {
        // Add reaction
        currentReactions[emoji] = [...userReactions, user.id];
      }

      const { error } = await supabase
        .from('messages')
        .update({ reactions: currentReactions })
        .eq('id', messageId);

      if (error) throw error;
      
      onReactionUpdate?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast.error("Failed to update reaction");
    }
  };

  const hasUserReacted = (emoji: string) => {
    if (!user) return false;
    return reactions[emoji]?.includes(user.id) || false;
  };

  const getReactionCount = (emoji: string) => {
    return reactions[emoji]?.length || 0;
  };

  const allReactions = Object.keys(reactions).filter(emoji => getReactionCount(emoji) > 0);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {allReactions.map(emoji => (
        <Button
          key={emoji}
          variant="outline"
          size="sm"
          className={`h-7 px-2 text-xs ${
            hasUserReacted(emoji) 
              ? 'bg-primary/10 border-primary/30' 
              : 'bg-background/50'
          }`}
          onClick={() => handleReaction(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span className="text-muted-foreground">{getReactionCount(emoji)}</span>
        </Button>
      ))}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <span className="text-lg">+</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {QUICK_REACTIONS.map(emoji => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className={`h-9 w-9 p-0 text-xl ${
                  hasUserReacted(emoji) ? 'bg-primary/10' : ''
                }`}
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
