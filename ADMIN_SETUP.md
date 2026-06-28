# Admin User Setup Guide

## Overview
This guide explains how to create and manage admin users in the Midwest Muslim Community Platform. The admin system uses a secure, database-driven approach that prevents privilege escalation attacks.

## Security Architecture

### Why Database-Only Admin Management?
- **Prevents Privilege Escalation**: Users cannot grant themselves admin access
- **Audit Trail**: All role changes are tracked in the database
- **Security Definer Functions**: Role checks bypass RLS to prevent recursive issues
- **No Client-Side Tampering**: Admin status cannot be manipulated via localStorage/sessionStorage

### Role System
The platform uses three roles defined in the `app_role` enum:
- `admin`: Full system access, can manage all content and users
- `moderator`: Can moderate content (future use)
- `user`: Default role for all registered users

## Creating Your First Admin User

### Step 1: Find Your User ID

**Option A - Via Supabase Dashboard:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/enevjiodbmngnkwkwuud)
2. Navigate to **Authentication** → **Users**
3. Find your user and copy the UUID

**Option B - Via SQL:**
```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

### Step 2: Execute Admin Creation SQL

**For taofikbusari@gmail.com (Already Configured):**
```sql
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES (
  '5af33675-43a6-47e2-b6cf-95b34690ae0e',
  'admin'::app_role,
  '5af33675-43a6-47e2-b6cf-95b34690ae0e'
);
```

**For a Different User:**
```sql
-- Replace YOUR_USER_ID_HERE with the actual UUID
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES (
  'YOUR_USER_ID_HERE',
  'admin'::app_role,
  'YOUR_USER_ID_HERE'
);
```

### Step 3: Verify Admin Creation

```sql
-- Check if admin was created successfully
SELECT ur.*, u.email 
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

You should see your user listed with the `admin` role.

## Using Admin Features

### Client-Side: useUserRoles Hook

```typescript
import { useUserRoles } from '@/hooks/useUserRoles';

function MyComponent() {
  const { isAdmin, isModerator, loading, hasRole } = useUserRoles();
  
  if (loading) return <div>Loading...</div>;
  
  if (!isAdmin) return <div>Access Denied</div>;
  
  return <div>Admin Content</div>;
}
```

### Protected Routes Example

```typescript
import { useUserRoles } from '@/hooks/useUserRoles';
import { Navigate } from 'react-router-dom';

function AdminOnlyPage() {
  const { isAdmin, loading } = useUserRoles();
  
  if (loading) return <div>Loading...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return <div>Admin Dashboard</div>;
}
```

### Database-Level: RLS Policies

RLS policies automatically use the `has_role()` function:

```sql
-- Example: Only admins can update mosque submissions
CREATE POLICY "Admins can update mosque submissions"
ON public.mosque_submissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));
```

## Managing Additional Admins

### Adding More Admins (As Existing Admin)

Once you have your first admin, you can add more through the database:

```sql
-- Must be executed by someone who already has admin access
-- Replace with the new admin's user ID
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES (
  'NEW_ADMIN_USER_ID',
  'admin'::app_role,
  auth.uid()  -- Automatically uses your ID as the creator
);
```

### Removing Admin Access

```sql
-- Remove admin role from a user
DELETE FROM public.user_roles
WHERE user_id = 'USER_ID_TO_REMOVE'
  AND role = 'admin';
```

### Adding Moderators

```sql
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES (
  'MODERATOR_USER_ID',
  'moderator'::app_role,
  auth.uid()
);
```

## Admin Capabilities

### Current Admin Features
- **Mosque Submissions**: View and approve/reject mosque submissions
- **Prayer Time Updates**: Review and apply prayer time update requests
- **Leadership Applications**: Review and manage leadership applications
- **User Role Management**: Grant/revoke roles for other users (via SQL)
- **Mosque Reviews**: Manage and moderate all reviews

### Planned Admin Features
- Content moderation dashboard
- User management interface
- Analytics and reporting
- Security log viewer
- Automated alerts for suspicious activity

## Security Best Practices

### DO ✅
- **Keep Admin Credentials Secure**: Use strong passwords and enable 2FA when available
- **Limit Admin Access**: Only grant admin to trusted users
- **Regular Audits**: Periodically review who has admin access
- **Use SQL for Role Management**: Always manage roles through database queries
- **Monitor Admin Actions**: Check `user_roles` table for unexpected changes

### DON'T ❌
- **Never Hardcode Admin Checks**: Don't use `if (user.email === 'admin@...')` 
- **Never Use Client-Side Storage**: Don't store admin status in localStorage
- **Never Skip RLS**: Don't disable RLS on tables containing sensitive data
- **Never Share Admin Accounts**: Each admin should have their own account
- **Never Trust Client-Side Validation**: Always verify permissions server-side

## Troubleshooting

### "Access Denied" Despite Being Admin

**Check 1: Verify role exists in database**
```sql
SELECT * FROM public.user_roles WHERE user_id = auth.uid();
```

**Check 2: Clear browser cache and re-login**
```typescript
// Force re-fetch of user roles
const { signOut, signIn } = useAuth();
await signOut();
await signIn(email, password);
```

**Check 3: Verify RLS policy uses has_role()**
```sql
-- Check if policy is using the security definer function
SELECT * FROM pg_policies WHERE tablename = 'your_table_name';
```

### useUserRoles Returns Empty Roles

**Possible causes:**
1. User not logged in (check `useAuth().user`)
2. Database query failing (check browser console for errors)
3. RLS policy blocking access (verify `user_roles` policies)

**Debug query:**
```sql
-- Run as the user to see what they can access
SELECT * FROM public.user_roles WHERE user_id = auth.uid();
```

### Can't Create First Admin

**If you get "permission denied":**
1. Ensure you're running the SQL in Supabase SQL Editor (has elevated privileges)
2. Don't try to run it through the application API
3. Use the service_role key if needed (via REST API)

**Alternative: Use Supabase service_role**
```bash
curl -X POST 'https://enevjiodbmngnkwkwuud.supabase.co/rest/v1/user_roles' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "role": "admin",
    "created_by": "YOUR_USER_ID"
  }'
```

## Audit Trail

All role changes are automatically tracked:

```sql
-- View role change history
SELECT 
  ur.*,
  u.email as user_email,
  creator.email as created_by_email,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
LEFT JOIN auth.users creator ON creator.id = ur.created_by
ORDER BY ur.created_at DESC;
```

## Security Functions Reference

### has_role(user_id, role)
**Purpose**: Check if a user has a specific role  
**Type**: Security Definer (runs with elevated privileges)  
**Usage**: Used in RLS policies and backend checks

```sql
-- Example usage in policy
CREATE POLICY "Admins only"
ON some_table
FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### get_user_roles(user_id)
**Purpose**: Get all roles for a user  
**Returns**: Set of app_role values  
**Usage**: Internal function for role queries

## Production Checklist

Before going to production with admin users:

- [ ] Created at least one admin user
- [ ] Tested admin can log in successfully
- [ ] Verified `useUserRoles` hook returns `isAdmin: true`
- [ ] Tested all admin-protected features work
- [ ] Confirmed RLS policies use `has_role()` function
- [ ] Documented who has admin access (off-system)
- [ ] Set up monitoring for role changes
- [ ] Tested that regular users can't access admin features
- [ ] Verified admin SQL commands work
- [ ] Created backup admin account (recommended)

## Support

For security issues or questions about admin access:
- Review this documentation first
- Check the `SECURITY.md` file for overall security architecture
- Verify RLS policies in Supabase Dashboard
- Monitor `security_logs` table for suspicious activity

---

**Last Updated**: 2025-01-27  
**Admin Count**: 1 (taofikbusari@gmail.com)  
**Next Review**: Before adding additional admins