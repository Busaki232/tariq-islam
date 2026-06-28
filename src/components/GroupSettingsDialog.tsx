import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Group } from '@/hooks/useUserGroups';
import { useGroupMembers } from '@/hooks/useGroupMembers';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { UserPlus, UserMinus, Shield, Users as UsersIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import AddGroupMembersDialog from './AddGroupMembersDialog';

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
}

const GroupSettingsDialog = ({ open, onOpenChange, group }: GroupSettingsDialogProps) => {
  const { user } = useAuth();
  const { members, loading, removeMember, updateMemberRole } = useGroupMembers(group.id);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const isAdmin = members.find(m => m.user_id === user?.id)?.role === 'admin';

  const handleRemoveMember = async (memberId: string) => {
    const result = await removeMember(memberId);
    if (result.success) {
      toast.success('Member removed');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'moderator' | 'member') => {
    const result = await updateMemberRole(memberId, newRole);
    if (result.success) {
      toast.success('Role updated');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">
              <UsersIcon className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="info">Group Info</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={() => setShowAddMembers(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Members
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar_url} alt={member.full_name} />
                        <AvatarFallback>
                          {member.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.full_name || 'Unknown User'}</p>
                        {member.location && (
                          <p className="text-sm text-muted-foreground">{member.location}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {member.role}
                      </Badge>
                      
                      {isAdmin && member.user_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <p className="text-sm font-medium p-3 border rounded-lg">
                {group.name}
              </p>
            </div>

            {group.description && (
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground p-3 border rounded-lg">
                  {group.description}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Group Type</Label>
              <p className="text-sm capitalize p-3 border rounded-lg">
                {group.group_type.replace('_', ' ')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground p-3 border rounded-lg">
                {new Date(group.created_at).toLocaleDateString()}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Add Members Dialog */}
      <AddGroupMembersDialog
        open={showAddMembers}
        onOpenChange={setShowAddMembers}
        group={group}
        onMembersAdded={() => {
          // Members list will refresh automatically via real-time subscription
        }}
      />
    </Dialog>
  );
};

export default GroupSettingsDialog;
