import { useOnlineUsers } from "@/hooks/useOnlineUsers";

export default function OnlinePresenceTracker() {
  // Just mounting this will subscribe + track your user presence
  useOnlineUsers();
  return null;
}