import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, mosqueId, autoJoinGroups } = await req.json();

    if (!userId || !mosqueId) {
      throw new Error('Missing userId or mosqueId');
    }

    console.log(`Syncing groups for user ${userId} following mosque ${mosqueId}`);

    if (autoJoinGroups) {
      // Get all verified mosque groups
      const { data: mosqueGroups, error: groupsError } = await supabase
        .from('mosque_groups')
        .select('group_id, chat_groups(name)')
        .eq('mosque_id', mosqueId)
        .eq('is_verified', true);

      if (groupsError) {
        throw groupsError;
      }

      console.log(`Found ${mosqueGroups?.length || 0} verified groups to join`);

      // Add user to all verified groups
      if (mosqueGroups && mosqueGroups.length > 0) {
        const memberships = mosqueGroups.map(mg => ({
          user_id: userId,
          group_id: mg.group_id,
          role: 'member',
        }));

        const { error: memberError } = await supabase
          .from('group_members')
          .upsert(memberships, { onConflict: 'user_id,group_id' });

        if (memberError) {
          console.error('Error adding user to groups:', memberError);
        } else {
          console.log(`Successfully added user to ${memberships.length} groups`);
        }

        // Send welcome messages to each group
        for (const mg of mosqueGroups) {
          try {
            const { error: messageError } = await supabase
              .from('messages')
              .insert({
                group_id: mg.group_id,
                sender_id: userId,
                content: `🕌 Welcome to the group! Thank you for following our mosque.`,
                message_type: 'text',
              });

            if (messageError) {
              console.error(`Failed to send welcome message to group ${mg.group_id}:`, messageError);
            }
          } catch (err) {
            console.error(`Error sending welcome message:`, err);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        groupsJoined: autoJoinGroups ? mosqueGroups?.length || 0 : 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in mosque-group-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
