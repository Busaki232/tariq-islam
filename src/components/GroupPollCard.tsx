import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useGroupPolls } from "@/hooks/useGroupPolls";
import { CheckCircle2 } from "lucide-react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface GroupPollCardProps {
  pollId: string;
  question: string;
  options: PollOption[];
  pollType: string;
  isAnonymous: boolean;
  closesAt?: string;
  groupId: string;
}

const GroupPollCard = ({
  pollId,
  question,
  options,
  pollType,
  isAnonymous,
  closesAt,
  groupId,
}: GroupPollCardProps) => {
  const { votePoll } = useGroupPolls(groupId);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);

  const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);
  const isClosed = closesAt && new Date(closesAt) < new Date();

  const handleVote = () => {
    if (selectedOptions.length > 0) {
      votePoll({ pollId, optionIds: selectedOptions });
      setHasVoted(true);
    }
  };

  const handleSingleSelect = (optionId: string) => {
    setSelectedOptions([optionId]);
  };

  const handleMultiSelect = (optionId: string, checked: boolean) => {
    if (checked) {
      setSelectedOptions([...selectedOptions, optionId]);
    } else {
      setSelectedOptions(selectedOptions.filter(id => id !== optionId));
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{question}</h3>
        {isClosed && (
          <p className="text-sm text-muted-foreground">Poll closed</p>
        )}
        {!isClosed && closesAt && (
          <p className="text-sm text-muted-foreground">
            Closes {new Date(closesAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {!hasVoted && !isClosed ? (
        <div className="space-y-3">
          {pollType === "single" ? (
            <RadioGroup value={selectedOptions[0]} onValueChange={handleSingleSelect}>
              {options.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id}>{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="space-y-2">
              {options.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={selectedOptions.includes(option.id)}
                    onCheckedChange={(checked) =>
                      handleMultiSelect(option.id, checked as boolean)
                    }
                  />
                  <Label htmlFor={option.id}>{option.text}</Label>
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={handleVote}
            disabled={selectedOptions.length === 0}
            className="w-full"
          >
            Vote
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            return (
              <div key={option.id} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    {option.text}
                    {hasVoted && selectedOptions.includes(option.id) && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {option.votes} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground text-center">
            {totalVotes} total {totalVotes === 1 ? "vote" : "votes"}
          </p>
        </div>
      )}
    </Card>
  );
};

export default GroupPollCard;
