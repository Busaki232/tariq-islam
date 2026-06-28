import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HadithData {
  arabicText: string;
  englishText: string;
  narrator: string;
  book: string;
  reference: string;
  grade?: string;
}

const hadiths: HadithData[] = [
  {
    arabicText: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
    englishText: "Actions are but by intentions, and every man shall have only that which he intended.",
    narrator: "Umar ibn Al-Khattab",
    book: "Sahih Bukhari",
    reference: "Book 1, Hadith 1",
    grade: "Sahih"
  },
  {
    arabicText: "مَنْ غَشَّنَا فَلَيْسَ مِنَّا",
    englishText: "He who cheats us is not one of us.",
    narrator: "Abu Hurairah",
    book: "Sahih Muslim",
    reference: "Book 1, Hadith 164",
    grade: "Sahih"
  },
  {
    arabicText: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ",
    englishText: "A Muslim is one from whose tongue and hand the Muslims are safe.",
    narrator: "Abdullah ibn Amr",
    book: "Sahih Bukhari",
    reference: "Book 2, Hadith 9",
    grade: "Sahih"
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active community groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from('chat_groups')
      .select('id, name')
      .eq('is_active', true)
      .eq('group_type', 'community');

    if (groupsError) throw groupsError;

    // Select hadith of the day (based on day of year)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const hadith = hadiths[dayOfYear % hadiths.length];

    // Post hadith to each community group
    const results = [];
    for (const group of groups || []) {
      const { data, error } = await supabaseClient
        .from('messages')
        .insert({
          group_id: group.id,
          sender_id: '00000000-0000-0000-0000-000000000000', // System user
          content: JSON.stringify(hadith),
          message_type: 'hadith'
        });

      results.push({
        group: group.name,
        success: !error,
        error: error?.message
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        hadith,
        groupsUpdated: results.filter(r => r.success).length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error posting hadith:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
