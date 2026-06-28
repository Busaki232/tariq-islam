// src/components/chat/ChatComposer.tsx
import React, { useMemo, useState } from "react";
import { Smile, Send, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void | Promise<void>;

  placeholder?: string;
  disabled?: boolean;

  // Emoji picker (real)
  showEmojiPicker?: boolean;
  onEmojiSelect?: (emoji: string) => void;
  emojiAriaLabel?: string;
  emojiSearchPlaceholder?: string;
  emojiPickerTitle?: string;

  sendAriaLabel?: string;

  // Extra buttons (image upload, mic, etc)
  actions?: React.ReactNode;

  // Small note under the input
  helperText?: string;

  className?: string;
};

const DEFAULT_EMOJIS: string[] = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘","😋","😎","🤗","🤔",
  "😐","😶","🙄","😮","😴","😌","😤","😭","😡","🤲","🙏","🤝","👍","👎","❤️","💚","💙","💛","💜","🖤",
  "✨","🔥","💯","🎉","✅","❌","⚠️","📌","🕌","📿","☪️","🌙","⭐","📖","🧕","🧔","👳","🧎","🤲","🕋",
];

export default function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,

  showEmojiPicker = true,
  onEmojiSelect,
  emojiAriaLabel = "Emoji",
  emojiSearchPlaceholder = "Search emoji...",
  emojiPickerTitle = "Emoji",

  sendAriaLabel = "Send",
  actions,
  helperText,
  className,
}: ChatComposerProps) {
  const canSend = !disabled && value.trim().length > 0;

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");

  const filtered = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    if (!q) return DEFAULT_EMOJIS;
    // simple search: match by a few keyword aliases (minimal + safe)
    const aliases: Record<string, string[]> = {
      "😊": ["smile", "happy"],
      "😂": ["laugh", "lol"],
      "😭": ["cry", "sad"],
      "😡": ["angry", "mad"],
      "❤️": ["heart", "love"],
      "👍": ["thumbs", "like", "good"],
      "🙏": ["pray", "thanks"],
      "🤲": ["dua", "pray"],
      "🌙": ["moon", "ramadan"],
      "🕌": ["mosque"],
      "☪️": ["islam"],
      "📿": ["tasbih"],
      "📖": ["quran", "book"],
      "🕋": ["kaaba", "hajj", "umrah"],
    };

    return DEFAULT_EMOJIS.filter((e) => {
      const keys = aliases[e] || [];
      return keys.some((k) => k.includes(q)) || keys.some((k) => q.includes(k));
    });
  }, [emojiQuery]);

  const handlePick = (emoji: string) => {
    if (onEmojiSelect) onEmojiSelect(emoji);
    else onChange(value + emoji);
    setEmojiOpen(false);
    setEmojiQuery("");
  };

   return (
     <div className={["border-t bg-background", className || ""].join(" ")}>
       <div className="px-2 py-1">
         <div className="flex items-end gap-2">
           <div className="flex-1 rounded-xl border bg-card px-2 py-1 shadow-sm">
             <div className="flex items-center gap-1.5">
               {showEmojiPicker ? (
                 <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                   <PopoverTrigger asChild>
                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8 shrink-0 rounded-lg"
                       aria-label={emojiAriaLabel}
                       title={emojiAriaLabel}
                       disabled={disabled}
                     >
                       <Smile className="h-4 w-4" />
                     </Button>
                   </PopoverTrigger>

                   <PopoverContent align="start" className="w-64 p-2">
                     <div className="text-xs font-medium mb-2">{emojiPickerTitle}</div>

                     <div className="flex items-center gap-1.5 mb-2 rounded-lg border bg-background px-2">
                       <Search className="h-3.5 w-3.5 text-muted-foreground" />
                       <input
                         value={emojiQuery}
                         onChange={(e) => setEmojiQuery(e.target.value)}
                         placeholder={emojiSearchPlaceholder}
                         className="h-8 w-full bg-transparent text-xs outline-none"
                       />
                     </div>

                     <div className="grid grid-cols-8 gap-1 max-h-40 overflow-auto pr-1">
                       {(filtered.length ? filtered : DEFAULT_EMOJIS).map((e) => (
                         <button
                           key={e}
                           type="button"
                           className="h-8 w-8 rounded-md hover:bg-secondary/60 active:bg-secondary flex items-center justify-center text-base"
                           onClick={() => handlePick(e)}
                           aria-label={e}
                           title={e}
                         >
                           {e}
                         </button>
                       ))}
                     </div>
                   </PopoverContent>
                 </Popover>
               ) : null}

               <Input
                 value={value}
                 onChange={(e) => onChange(e.target.value)}
                 placeholder={placeholder}
                 disabled={disabled}
                 className="h-9 border-0 bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                 onKeyDown={(e) => {
                   if (e.key === "Enter" && !e.shiftKey) {
                     e.preventDefault();
                     void onSend();
                   }
                 }}
               />

               <Button
                 type="button"
                 className="h-9 w-9 shrink-0 rounded-lg p-0"
                 disabled={!canSend}
                 onClick={() => void onSend()}
                 aria-label={sendAriaLabel}
                 title={sendAriaLabel}
               >
                 <Send className="h-4 w-4" />
               </Button>
             </div>
           </div>

           {actions ? <div className="flex items-end gap-1.5">{actions}</div> : null}
         </div>

         {helperText ? (
           <p className="mt-1 text-[10px] leading-tight text-muted-foreground text-center">
             {helperText}
           </p>
         ) : null}
       </div>
     </div>
   );
};