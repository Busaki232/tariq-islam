import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface User {
  id: string;
  email: string;
  created_at: string;
  profile: {
    full_name: string;
    phone_number: string;
  } | null;
  roles: string[];
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' },
      });

      if (error) throw error;
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (email: string, password: string, fullName: string, phone: string, roles: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email,
          password,
          fullName,
          phone,
          roles,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User created successfully',
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const addRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'add_role',
          userId,
          role,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role added successfully',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error adding role:', error);
      toast({
        title: 'Error',
        description: 'Failed to add role',
        variant: 'destructive',
      });
    }
  };

  const removeRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'remove_role',
          userId,
          role,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role removed successfully',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove role',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  return {
    users,
    loading,
    fetchUsers,
    createUser,
    addRole,
    removeRole,
    deleteUser,
  };
};
