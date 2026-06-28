import type { Group } from "@/hooks/useUserGroups";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";

interface GroupsListProps {
  groups: Group[];
  selectedGroup: Group | null;
  onSelectGroup: (group: Group) => void;
}

const GroupsList = ({ groups, selectedGroup, onSelectGroup }: GroupsListProps) => {
  const getGroupIcon = (type: string) => {
    const colors = {
      community: "bg-blue-500",
      mosque_official: "bg-green-500",
      study_circle: "bg-purple-500",
      private: "bg-gray-500",
    };
    return colors[type as keyof typeof colors] || colors.private;
  };

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No groups yet</p>
          <p className="text-sm">Create a group to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelectGroup(group)}
          className={`w-full p-4 border-b hover:bg-accent transition-colors text-left ${
            selectedGroup?.id === group.id ? "bg-accent" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={group.avatar_url ?? undefined} alt={group.name} />
              <AvatarFallback className={getGroupIcon(group.group_type)}>
                <Users className="h-6 w-6 text-white" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold truncate">{group.name}</h3>
                {!!group.unread_count && group.unread_count > 0 && (
                  <Badge variant="default" className="flex-shrink-0">
                    {group.unread_count}
                  </Badge>
                )}
              </div>

              {group.last_message && (
                <p className="text-sm text-muted-foreground truncate mb-1">{group.last_message}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{String(group.group_type).replace(/_/g, " ")}</span>
                {group.last_message_at && (
                  <>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(group.last_message_at), { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default GroupsList;