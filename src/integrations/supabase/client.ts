// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://enevjiodbmngnkwkwuud.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZXZqaW9kYm1uZ25rd2t3dXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NjAwNDksImV4cCI6MjA3NDMzNjA0OX0.S32V7VzipElYgj8l21-xMMEji6fcnAloBYuOAjERz-w";

const ENV_URL =
  (import.meta as any)?.env?.VITE_SUPABASE_URL ||
  (window as any)?.VITE_SUPABASE_URL ||
  (window as any)?.__ENV?.VITE_SUPABASE_URL;

const ENV_KEY =
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
  (window as any)?.VITE_SUPABASE_ANON_KEY ||
  (window as any)?.__ENV?.VITE_SUPABASE_ANON_KEY;

const SUPABASE_URL = (ENV_URL && String(ENV_URL).trim()) || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = (ENV_KEY && String(ENV_KEY).trim()) || FALLBACK_SUPABASE_ANON_KEY;

if (!ENV_URL || !ENV_KEY) {
  console.warn("[Supabase] Missing env config. Using fallback values.");
}

// Quiet fetch wrapper:
// Supabase Storage returns 400 with JSON body { error: "not_found", statusCode: "404" }
// for missing objects when calling /object/sign/.
// We return the response without any extra logging.
const quietSupabaseFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const res = await fetch(input, init);

  if (url.includes("/storage/v1/object/sign/") && (res.status === 400 || res.status === 404)) {
    try {
      const body = await res.clone().json();
      if (body?.error === "not_found" || body?.statusCode === 404) {
        return res;
      }
    } catch {
      // ignore parse errors
    }
  }

  return res;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: quietSupabaseFetch,
  },
});