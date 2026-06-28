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

    console.log('Checking for scheduled messages to send...');

    // Get all active scheduled messages that are due
    const now = new Date();
    const { data: dueMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('is_active', true)
      .lte('next_send_at', now.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${dueMessages?.length || 0} messages to send`);

    for (const schedule of dueMessages || []) {
      try {
        // Send message to group
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            group_id: schedule.group_id,
            sender_id: schedule.created_by,
            content: schedule.content,
            message_type: schedule.message_type,
            metadata: schedule.metadata,
          });

        if (messageError) {
          console.error(`Failed to send message for schedule ${schedule.id}:`, messageError);
          continue;
        }

        // Calculate next send time
        const nextSendAt = calculateNextSendTime(schedule);
        
        // Update schedule
        const { error: updateError } = await supabase
          .from('scheduled_messages')
          .update({
            last_sent_at: now.toISOString(),
            next_send_at: nextSendAt,
          })
          .eq('id', schedule.id);

        if (updateError) {
          console.error(`Failed to update schedule ${schedule.id}:`, updateError);
        } else {
          console.log(`Successfully sent scheduled message ${schedule.id}`);
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messagesSent: dueMessages?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in scheduled-message-sender:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateNextSendTime(schedule: any): string | null {
  const now = new Date();
  const scheduleTime = schedule.schedule_time.split(':');
  const hours = parseInt(scheduleTime[0]);
  const minutes = parseInt(scheduleTime[1]);

  let nextDate = new Date(now);
  nextDate.setHours(hours, minutes, 0, 0);

  switch (schedule.schedule_type) {
    case 'daily':
      if (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      break;

    case 'weekly':
      const scheduleDays = schedule.schedule_days || [];
      if (scheduleDays.length === 0) return null;
      
      let daysToAdd = 1;
      while (daysToAdd < 8) {
        nextDate.setDate(nextDate.getDate() + 1);
        if (scheduleDays.includes(nextDate.getDay())) {
          break;
        }
        daysToAdd++;
      }
      break;

    case 'monthly':
      const scheduleDates = schedule.schedule_days || [];
      if (scheduleDates.length === 0) return null;
      
      nextDate.setMonth(nextDate.getMonth() + 1);
      const nextDay = scheduleDates.find((d: number) => d >= nextDate.getDate()) || scheduleDates[0];
      nextDate.setDate(nextDay);
      break;

    case 'once':
      if (nextDate <= now) {
        return null; // Don't reschedule one-time messages
      }
      break;

    default:
      return null;
  }

  // Check if we've passed the end date
  if (schedule.end_date && new Date(schedule.end_date) < nextDate) {
    return null;
  }

  return nextDate.toISOString();
}
