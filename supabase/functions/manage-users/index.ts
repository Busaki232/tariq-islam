import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, email, password, fullName, phone, roles: userRoles, userId, role } = await req.json();

    if (action === 'create') {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (createError) throw createError;

      // Create profile
      await supabaseAdmin.from('profiles').insert({
        user_id: newUser.user.id,
        full_name: fullName,
        phone_number: phone,
      });

      // Assign roles
      if (userRoles && userRoles.length > 0) {
        await supabaseAdmin.from('user_roles').insert(
          userRoles.map((r: string) => ({
            user_id: newUser.user.id,
            role: r,
            created_by: user.id,
          }))
        );
      }

      // Log action
      await supabaseAdmin.rpc('log_admin_user_action', {
        _action_type: 'user_created',
        _target_user_id: newUser.user.id,
        _target_email: email,
        _details: { roles: userRoles },
      });

      return new Response(JSON.stringify({ success: true, user: newUser.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add_role') {
      const { error } = await supabaseAdmin.from('user_roles').insert({
        user_id: userId,
        role,
        created_by: user.id,
      });

      if (error) throw error;

      await supabaseAdmin.rpc('log_admin_user_action', {
        _action_type: 'role_added',
        _target_user_id: userId,
        _target_email: null,
        _details: { role },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove_role') {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      await supabaseAdmin.rpc('log_admin_user_action', {
        _action_type: 'role_removed',
        _target_user_id: userId,
        _target_email: null,
        _details: { role },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      // Prevent admins from deleting themselves
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user exists in Auth
      let authUserExists = false;
      let userData: any = null;
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser && !authError) {
          authUserExists = true;
          userData = authUser;
        } else if (authError && authError.message?.includes('User not found')) {
          console.log(`User ${userId} not found in Auth, proceeding with database cleanup only`);
          authUserExists = false;
        } else {
          throw authError;
        }
      } catch (error: any) {
        if (error.message?.includes('User not found')) {
          console.log(`User ${userId} not found in Auth, proceeding with database cleanup only`);
          authUserExists = false;
        } else {
          throw error;
        }
      }
      
      console.log(`Starting deletion cleanup for user: ${userId} (Auth exists: ${authUserExists})`);
      const cleanupLog: string[] = [];

      try {
        // 1. Delete user's messages (sender)
        const { data: deletedSentMessages, error: sentMessagesError } = await supabaseAdmin
          .from('messages')
          .delete()
          .eq('sender_id', userId)
          .select('id');
        
        if (sentMessagesError) throw new Error(`Failed to delete sent messages: ${sentMessagesError.message}`);
        cleanupLog.push(`Deleted ${deletedSentMessages?.length || 0} sent messages`);

        // 2. Delete user's messages (recipient)
        const { data: deletedReceivedMessages, error: receivedMessagesError } = await supabaseAdmin
          .from('messages')
          .delete()
          .eq('recipient_id', userId)
          .select('id');
        
        if (receivedMessagesError) throw new Error(`Failed to delete received messages: ${receivedMessagesError.message}`);
        cleanupLog.push(`Deleted ${deletedReceivedMessages?.length || 0} received messages`);

        // 3. Delete user's business messages (sender)
        const { data: deletedSentBizMessages, error: sentBizError } = await supabaseAdmin
          .from('business_messages')
          .delete()
          .eq('sender_id', userId)
          .select('id');
        
        if (sentBizError) throw new Error(`Failed to delete sent business messages: ${sentBizError.message}`);
        cleanupLog.push(`Deleted ${deletedSentBizMessages?.length || 0} sent business messages`);

        // 4. Delete user's business messages (recipient)
        const { data: deletedReceivedBizMessages, error: receivedBizError } = await supabaseAdmin
          .from('business_messages')
          .delete()
          .eq('recipient_id', userId)
          .select('id');
        
        if (receivedBizError) throw new Error(`Failed to delete received business messages: ${receivedBizError.message}`);
        cleanupLog.push(`Deleted ${deletedReceivedBizMessages?.length || 0} received business messages`);

        // 5. Delete user's message attachments
        const { data: deletedAttachments, error: attachmentsError } = await supabaseAdmin
          .from('message_attachments')
          .delete()
          .eq('uploaded_by', userId)
          .select('id');
        
        if (attachmentsError) throw new Error(`Failed to delete message attachments: ${attachmentsError.message}`);
        cleanupLog.push(`Deleted ${deletedAttachments?.length || 0} message attachments`);

        // 6. Delete user's events
        const { data: deletedEvents, error: eventsError } = await supabaseAdmin
          .from('events')
          .delete()
          .eq('organizer_id', userId)
          .select('id');
        
        if (eventsError) throw new Error(`Failed to delete events: ${eventsError.message}`);
        cleanupLog.push(`Deleted ${deletedEvents?.length || 0} events`);

        // 7. Delete user's call participants
        const { data: deletedParticipants, error: participantsError } = await supabaseAdmin
          .from('call_participants')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (participantsError) throw new Error(`Failed to delete call participants: ${participantsError.message}`);
        cleanupLog.push(`Deleted ${deletedParticipants?.length || 0} call participants`);

        // 8. Delete user's call sessions
        const { data: deletedSessions, error: sessionsError } = await supabaseAdmin
          .from('call_sessions')
          .delete()
          .eq('initiated_by', userId)
          .select('id');
        
        if (sessionsError) throw new Error(`Failed to delete call sessions: ${sessionsError.message}`);
        cleanupLog.push(`Deleted ${deletedSessions?.length || 0} call sessions`);

        // 9. Delete user's event waitlist entries
        const { data: deletedWaitlist, error: waitlistError } = await supabaseAdmin
          .from('event_waitlist')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (waitlistError) throw new Error(`Failed to delete event waitlist: ${waitlistError.message}`);
        cleanupLog.push(`Deleted ${deletedWaitlist?.length || 0} waitlist entries`);

        // 10. Delete user's own leadership applications
        const { data: deletedOwnApps, error: ownAppsError } = await supabaseAdmin
          .from('leadership_applications')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (ownAppsError) throw new Error(`Failed to delete own leadership applications: ${ownAppsError.message}`);
        cleanupLog.push(`Deleted ${deletedOwnApps?.length || 0} own leadership applications`);

        // 11. Delete user's own roles
        const { data: deletedOwnRoles, error: ownRolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (ownRolesError) throw new Error(`Failed to delete user roles: ${ownRolesError.message}`);
        cleanupLog.push(`Deleted ${deletedOwnRoles?.length || 0} user roles`);

        // 12. Delete user's advertisements
        const { data: deletedAds, error: adsError } = await supabaseAdmin
          .from('advertisements')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (adsError) throw new Error(`Failed to delete advertisements: ${adsError.message}`);
        cleanupLog.push(`Deleted ${deletedAds?.length || 0} advertisements`);

        // 13. Remove user from all groups
        const { data: deletedMemberships, error: membersError } = await supabaseAdmin
          .from('group_members')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (membersError) throw new Error(`Failed to delete group memberships: ${membersError.message}`);
        cleanupLog.push(`Removed from ${deletedMemberships?.length || 0} groups`);

        // 14. Remove mosque following relationships
        const { data: deletedFollows, error: followsError } = await supabaseAdmin
          .from('mosque_followers')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (followsError) throw new Error(`Failed to delete mosque followers: ${followsError.message}`);
        cleanupLog.push(`Removed ${deletedFollows?.length || 0} mosque follows`);

        // 15. Delete user's event RSVPs
        const { data: deletedRsvps, error: rsvpsError } = await supabaseAdmin
          .from('event_rsvps')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (rsvpsError) throw new Error(`Failed to delete event RSVPs: ${rsvpsError.message}`);
        cleanupLog.push(`Deleted ${deletedRsvps?.length || 0} event RSVPs`);

        // 16. Delete user's contact requests
        const { data: deletedRequests, error: requestsError } = await supabaseAdmin
          .from('contact_requests')
          .delete()
          .eq('requester_id', userId)
          .select('id');
        
        if (requestsError) throw new Error(`Failed to delete contact requests: ${requestsError.message}`);
        cleanupLog.push(`Deleted ${deletedRequests?.length || 0} contact requests`);

        // 17. Delete user's conversations
        const { data: deletedConversations, error: conversationsError } = await supabaseAdmin
          .from('conversations')
          .delete()
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .select('id');
        
        if (conversationsError) throw new Error(`Failed to delete conversations: ${conversationsError.message}`);
        cleanupLog.push(`Deleted ${deletedConversations?.length || 0} conversations`);

        // === Update audit/logging tables (set to NULL) ===
        
        // 18. Set reviewed_by to NULL in leadership_applications
        const { data: updatedApplications, error: appsError } = await supabaseAdmin
          .from('leadership_applications')
          .update({ reviewed_by: null })
          .eq('reviewed_by', userId)
          .select('id');
        
        if (appsError) throw new Error(`Failed to update leadership applications: ${appsError.message}`);
        cleanupLog.push(`Updated ${updatedApplications?.length || 0} leadership applications`);

        // 19. Set reviewed_by to NULL in mosque_submissions
        const { data: updatedSubmissions, error: submissionsError } = await supabaseAdmin
          .from('mosque_submissions')
          .update({ reviewed_by: null })
          .eq('reviewed_by', userId)
          .select('id');
        
        if (submissionsError) throw new Error(`Failed to update mosque submissions: ${submissionsError.message}`);
        cleanupLog.push(`Updated ${updatedSubmissions?.length || 0} mosque submissions`);

        // 20. Set reviewed_by to NULL in prayer_time_updates
        const { data: updatedPrayers, error: prayersError } = await supabaseAdmin
          .from('prayer_time_updates')
          .update({ reviewed_by: null })
          .eq('reviewed_by', userId)
          .select('id');
        
        if (prayersError) throw new Error(`Failed to update prayer time updates: ${prayersError.message}`);
        cleanupLog.push(`Updated ${updatedPrayers?.length || 0} prayer time updates`);

        // 21. Set created_by to NULL in user_roles
        const { data: updatedRolesCreatedBy, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .update({ created_by: null })
          .eq('created_by', userId)
          .select('id');
        
        if (rolesError) throw new Error(`Failed to update user roles created_by: ${rolesError.message}`);
        cleanupLog.push(`Updated ${updatedRolesCreatedBy?.length || 0} user roles (created_by)`);

        // 22. Set claimed_by to NULL in mosques
        const { data: updatedMosques, error: mosquesError } = await supabaseAdmin
          .from('mosques')
          .update({ claimed_by: null })
          .eq('claimed_by', userId)
          .select('id');
        
        if (mosquesError) throw new Error(`Failed to update mosques: ${mosquesError.message}`);
        cleanupLog.push(`Updated ${updatedMosques?.length || 0} mosques`);

        // 23. Set status_changed_by to NULL in contact_requests
        const { data: updatedRequests, error: updateRequestsError } = await supabaseAdmin
          .from('contact_requests')
          .update({ status_changed_by: null })
          .eq('status_changed_by', userId)
          .select('id');
        
        if (updateRequestsError) throw new Error(`Failed to update contact requests: ${updateRequestsError.message}`);
        cleanupLog.push(`Updated ${updatedRequests?.length || 0} contact requests (status_changed_by)`);

        // 24. Set moderator_id and target_user_id to NULL in moderation_logs
        const { data: updatedModLogs1, error: modLogs1Error } = await supabaseAdmin
          .from('moderation_logs')
          .update({ moderator_id: null })
          .eq('moderator_id', userId)
          .select('id');
        
        if (modLogs1Error) throw new Error(`Failed to update moderation logs (moderator): ${modLogs1Error.message}`);
        cleanupLog.push(`Updated ${updatedModLogs1?.length || 0} moderation logs (moderator)`);

        const { data: updatedModLogs2, error: modLogs2Error } = await supabaseAdmin
          .from('moderation_logs')
          .update({ target_user_id: null })
          .eq('target_user_id', userId)
          .select('id');
        
        if (modLogs2Error) throw new Error(`Failed to update moderation logs (target): ${modLogs2Error.message}`);
        cleanupLog.push(`Updated ${updatedModLogs2?.length || 0} moderation logs (target)`);

        // 25. Set admin_user_id to NULL in admin_audit_log
        const { data: updatedAuditLogs, error: auditLogsError } = await supabaseAdmin
          .from('admin_audit_log')
          .update({ admin_user_id: null })
          .eq('admin_user_id', userId)
          .select('id');
        
        if (auditLogsError) throw new Error(`Failed to update admin audit logs: ${auditLogsError.message}`);
        cleanupLog.push(`Updated ${updatedAuditLogs?.length || 0} admin audit logs`);

        // 26. Set admin_user_id and target_user_id to NULL in admin_user_actions
        const { data: updatedUserActions1, error: userActions1Error } = await supabaseAdmin
          .from('admin_user_actions')
          .update({ admin_user_id: null })
          .eq('admin_user_id', userId)
          .select('id');
        
        if (userActions1Error) throw new Error(`Failed to update admin user actions (admin): ${userActions1Error.message}`);
        cleanupLog.push(`Updated ${updatedUserActions1?.length || 0} admin user actions (admin)`);

        const { data: updatedUserActions2, error: userActions2Error } = await supabaseAdmin
          .from('admin_user_actions')
          .update({ target_user_id: null })
          .eq('target_user_id', userId)
          .select('id');
        
        if (userActions2Error) throw new Error(`Failed to update admin user actions (target): ${userActions2Error.message}`);
        cleanupLog.push(`Updated ${updatedUserActions2?.length || 0} admin user actions (target)`);

        // === CRITICAL: Delete profile last before auth deletion ===
        
        // 27. Delete user's profile (MUST BE LAST BEFORE AUTH)
        const { data: deletedProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('user_id', userId)
          .select('id');
        
        if (profileError) throw new Error(`Failed to delete profile: ${profileError.message}`);
        cleanupLog.push(`Deleted ${deletedProfile?.length || 0} profiles`);

        console.log('Database cleanup completed:', cleanupLog.join(', '));

        // Now delete the user from auth if they exist
        if (authUserExists) {
          try {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            
            if (deleteError) {
              // Check if it's a "user not found" error - treat as success
              if (deleteError.message?.includes('User not found')) {
                console.log(`User ${userId} already deleted from Auth, continuing...`);
                cleanupLog.push('Auth user already deleted (no action needed)');
              } else {
                throw new Error(`Failed to delete user from auth: ${deleteError.message}`);
              }
            } else {
              cleanupLog.push('Deleted user from Auth');
            }
          } catch (authError: any) {
            if (authError.message?.includes('User not found')) {
              console.log(`User ${userId} not found in Auth during deletion, treating as success`);
              cleanupLog.push('Auth user not found (already deleted)');
            } else {
              throw authError;
            }
          }
        } else {
          cleanupLog.push('Skipped Auth deletion (user not found in Auth)');
        }

        // Log the deletion action
        await supabaseAdmin.rpc('log_admin_user_action', {
          _action_type: 'user_deleted',
          _target_user_id: userId,
          _target_email: userData?.user?.email || null,
          _details: { 
            deleted_by: user.id,
            cleanup_summary: cleanupLog,
            auth_user_existed: authUserExists
          },
        });

        return new Response(JSON.stringify({ 
          success: true, 
          cleanup_summary: cleanupLog 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (cleanupError: any) {
        console.error('Cleanup error:', cleanupError);
        return new Response(JSON.stringify({ 
          error: `Database error deleting user: ${cleanupError.message}`,
          cleanup_log: cleanupLog 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'list') {
      // Get all users with their roles
      const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
      const { data: allRoles } = await supabaseAdmin.from('user_roles').select('*');

      const users = authUsers.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        profile: profiles?.find(p => p.user_id === u.id),
        roles: allRoles?.filter(r => r.user_id === u.id).map(r => r.role) || [],
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
