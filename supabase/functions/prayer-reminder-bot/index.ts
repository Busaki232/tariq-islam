import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { prayerName, time } = await req.json();

    // Get all active community groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from('chat_groups')
      .select('id, name')
      .eq('is_active', true)
      .eq('group_type', 'community');

    if (groupsError) throw groupsError;

    // Post prayer reminder to each community group
    const results = [];
    for (const group of groups || []) {
      const message = `🕌 ${prayerName} prayer time is ${time}`;
      
      const { error } = await supabaseClient
        .from('messages')
        .insert({
          group_id: group.id,
          sender_id: '00000000-0000-0000-0000-000000000000', // System user
          content: message,
          message_type: 'text'
        });

      // Create Jumuah poll on Fridays for Dhuhr
      if (prayerName === 'Jumu\'ah') {
        await supabaseClient
          .from('messages')
          .insert({
            group_id: group.id,
            sender_id: '00000000-0000-0000-0000-000000000000',
            content: 'Jumu\'ah Poll',
            message_type: 'jumuah_poll'
          });
      }

      results.push({
        group: group.name,
        success: !error,
        error: error?.message
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        prayerName,
        time,
        groupsUpdated: results.filter(r => r.success).length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error posting prayer reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
