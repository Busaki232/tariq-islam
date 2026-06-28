import { useState } from 'react';
import { useUsers, User } from '@/hooks/useUsers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface ManageRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

const availableRoles = ['user', 'moderator', 'admin'];

export const ManageRolesDialog = ({ open, onOpenChange, user }: ManageRolesDialogProps) => {
  const { addRole, removeRole } = useUsers();
  const [loading, setLoading] = useState(false);

  const handleAddRole = async (role: string) => {
    setLoading(true);
    await addRole(user.id, role);
    setLoading(false);
  };

  const handleRemoveRole = async (role: string) => {
    setLoading(true);
    await removeRole(user.id, role);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Roles</DialogTitle>
          <DialogDescription>
            Manage roles for {user.profile?.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Current Roles</h3>
            <div className="flex flex-wrap gap-2">
              {user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <Badge key={role} variant="default" className="flex items-center gap-1">
                    {role}
                    <button
                      onClick={() => handleRemoveRole(role)}
                      disabled={loading}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <Badge variant="outline">user (default)</Badge>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Add Role</h3>
            <div className="flex flex-wrap gap-2">
              {availableRoles
                .filter(role => !user.roles.includes(role))
                .map((role) => (
                  <Button
                    key={role}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddRole(role)}
                    disabled={loading}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {role}
                  </Button>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
