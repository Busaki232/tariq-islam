// supabase/functions/delete-account/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      });
    }

    console.log("Deleting user:", userId);

    // 🔥 STEP 1: Delete related data (adjust tables if needed)

    await supabase.from("profiles").delete().eq("user_id", userId);

    await supabase.from("blocked_users").delete().or(
      `blocker_id.eq.${userId},blocked_id.eq.${userId}`
    );

    // Add more tables here if needed:
    // await supabase.from("messages").delete().eq("user_id", userId);
    // await supabase.from("groups").delete().eq("owner_id", userId);

    // 🔥 STEP 2: Delete auth user (this is the critical part)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      throw authError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("DELETE ACCOUNT ERROR:", err);

    return new Response(
      JSON.stringify({
        error: err?.message || "Unexpected error",
      }),
      { status: 500 }
    );
  }
});