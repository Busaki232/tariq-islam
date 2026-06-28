import { Button } from "@/components/ui/button";
import { useMosqueFollowers } from "@/hooks/useMosqueFollowers";
import { Heart, UserPlus } from "lucide-react";

interface FollowMosqueButtonProps {
  mosqueId: string;
}

const FollowMosqueButton = ({ mosqueId }: FollowMosqueButtonProps) => {
  const { isFollowing, followMosque, unfollowMosque, followerCount, isLoading } =
    useMosqueFollowers(mosqueId);

  const handleClick = () => {
    if (isFollowing) {
      unfollowMosque(mosqueId);
    } else {
      followMosque({ mosqueId, autoJoinGroups: true });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant={isFollowing ? "secondary" : "default"}
        size="sm"
      >
        {isFollowing ? (
          <>
            <Heart className="h-4 w-4 mr-2 fill-current" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Follow
          </>
        )}
      </Button>
      <span className="text-sm text-muted-foreground">
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </span>
    </div>
  );
};

export default FollowMosqueButton;
