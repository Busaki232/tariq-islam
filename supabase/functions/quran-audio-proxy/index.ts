import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * CORS
 * - Fix: include https://localhost:<port> (your DevTools origin is https://localhost:8081)
 * - Fix: NEVER fall back to production origin when a different origin is supplied
 *   (that guarantees a CORS mismatch)
 */
const allowedOrigins = new Set([
  // Production
  "https://global-muslims-connect.com",
  "https://www.global-muslims-connect.com",

  // Local dev (http)
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",

  // Local dev (https) - IMPORTANT for DevTools/basic-ssl
  "https://localhost:8080",
  "https://127.0.0.1:8080",
  "https://localhost:8081",
  "https://127.0.0.1:8081",
]);

function cors(origin: string | null) {
  // If there's no Origin header (server-to-server / curl), you can safely use '*'
  // because we are not using credentials here.
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, range",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Audio-Source",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }

  // If Origin is not allowed, do NOT lie with a different allow-origin.
  // Return "null" so the browser blocks it cleanly.
  const allowOrigin = allowedOrigins.has(origin) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, range",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Audio-Source",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Rate limiting: Track requests by IP address
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 50;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(ip);

  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (existing.count >= MAX_REQUESTS_PER_HOUR) return false;

  existing.count++;
  return true;
}

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) rateLimitMap.delete(ip);
  }
}

function isValidSurahNumber(s: string): boolean {
  const n = Number(s);
  if (!Number.isFinite(n)) return false;
  return n >= 1 && n <= 114;
}

function normalizeSurah(s: string): string {
  const n = Number(s);
  return String(n).padStart(3, "0");
}

function safeText(v: string | null): string {
  return (v || "").toString();
}

// For HEAD requests, many upstream audio servers do NOT support HEAD properly.
// We simulate HEAD by requesting 1 byte via Range so we can return headers.
function rangeForHead(): string {
  return "bytes=0-0";
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = cors(origin);

  // Always respond to preflight quickly
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const isHead = req.method === "HEAD";
  const isGet = req.method === "GET";

  if (!isGet && !isHead) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If origin is not allowed, block early (browser will show CORS issue)
  if (origin && (corsHeaders["Access-Control-Allow-Origin"] === "null")) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Maximum 50 audio requests per hour.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (Math.random() < 0.02) cleanupRateLimitMap();

    const url = new URL(req.url);
    const surahRaw = safeText(url.searchParams.get("surah")).trim();
    const reciterSubdirectory = safeText(url.searchParams.get("reciter")).trim();

    if (!surahRaw || !reciterSubdirectory) {
      return new Response(
        JSON.stringify({ error: "Missing surah number or reciter subdirectory" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isValidSurahNumber(surahRaw)) {
      return new Response(JSON.stringify({ error: "Invalid surah number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const surahNumber = normalizeSurah(surahRaw);

    // If browser sends Range, forward it.
    // If browser sends HEAD, we simulate it using Range bytes=0-0 so we can return audio headers.
    const incomingRange = req.headers.get("range") || undefined;
    const range = isHead ? rangeForHead() : incomingRange;

    const audioSources = [
      `https://everyayah.com/data/${reciterSubdirectory}/${surahNumber}.mp3`,
      `https://server8.mp3quran.net/afs/${surahNumber}.mp3`,
      `https://verses.quran.com/AbdulBaset/Mujawwad/mp3/${surahNumber}.mp3`,
    ];

    let upstream: Response | null = null;
    let successfulUrl = "";

    for (const audioUrl of audioSources) {
      try {
        const headers: HeadersInit = {
          "User-Agent": "Mozilla/5.0 (compatible; QuranPlayer/1.0)",
          accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
        };
        if (range) headers["Range"] = range;

        const res = await fetch(audioUrl, { headers });

        // Accept 206 (partial) or 200 (some servers ignore range)
        if (res.status === 206 || res.status === 200) {
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          const looksAudio =
            ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream");

          if (!looksAudio) continue;

          upstream = res;
          successfulUrl = audioUrl;
          break;
        }
      } catch {
        // try next
      }
    }

    if (!upstream) {
      return new Response(
        JSON.stringify({ error: "Unable to fetch audio from any source" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build output headers
    const outHeaders = new Headers(corsHeaders);
    outHeaders.set("Content-Type", "audio/mpeg");
    outHeaders.set("Cache-Control", "public, max-age=86400");
    outHeaders.set("X-Audio-Source", successfulUrl);

    const isPartial =
      upstream.status === 206 && !!upstream.headers.get("content-range");

    if (isPartial) {
      const acceptRanges = upstream.headers.get("accept-ranges");
      if (acceptRanges) outHeaders.set("Accept-Ranges", acceptRanges);

      const contentRange = upstream.headers.get("content-range");
      if (contentRange) outHeaders.set("Content-Range", contentRange);
    } else {
      outHeaders.set("Accept-Ranges", "bytes");
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) outHeaders.set("Content-Length", contentLength);

    if (isHead) {
      return new Response(null, {
        status: upstream.status,
        headers: outHeaders,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});