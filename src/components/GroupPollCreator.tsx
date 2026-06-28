import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useGroupPolls } from "@/hooks/useGroupPolls";
import { PlusCircle, X } from "lucide-react";

interface GroupPollCreatorProps {
  groupId: string;
}

const GroupPollCreator = ({ groupId }: GroupPollCreatorProps) => {
  const { createPoll } = useGroupPolls(groupId);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pollType, setPollType] = useState<"single" | "multiple">("single");

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(opt => opt.trim() !== "");
    if (question.trim() && validOptions.length >= 2) {
      createPoll({
        groupId,
        question,
        options: validOptions,
        pollType,
        isAnonymous,
      });
      setOpen(false);
      setQuestion("");
      setOptions(["", ""]);
      setIsAnonymous(false);
      setPollType("single");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's your question?"
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="w-full"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="poll-type">Multiple choices allowed</Label>
            <Switch
              id="poll-type"
              checked={pollType === "multiple"}
              onCheckedChange={(checked) =>
                setPollType(checked ? "multiple" : "single")
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="anonymous">Anonymous voting</Label>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Create Poll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupPollCreator;
