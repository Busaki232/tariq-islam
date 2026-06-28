import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - Production domains only
const allowedOrigins = [
  'https://global-muslims-connect.com',
  'https://www.global-muslims-connect.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

// Rate limiting: Track requests by IP address
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_HOUR = 100; // 100 requests per IP per hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(ip);
  
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (existing.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }
  
  existing.count++;
  return true;
}

// Cleanup old entries periodically
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

interface PrayerTime {
  name: string;
  time: string;
  arabic: string;
}

interface PrayerTimesResponse {
  prayerTimes: PrayerTime[];
  currentPrayer: string;
  nextPrayer: string;
  timeUntilNext: string;
  location: string;
  date: string;
}

const prayerNames = {
  fajr: { english: 'Fajr', arabic: 'الفجر' },
  sunrise: { english: 'Sunrise', arabic: 'الشروق' },
  dhuhr: { english: 'Dhuhr', arabic: 'الظهر' },
  asr: { english: 'Asr', arabic: 'العصر' },
  maghrib: { english: 'Maghrib', arabic: 'المغرب' },
  isha: { english: 'Isha', arabic: 'العشاء' },
};

// Function to get timezone offset in hours
const getTimezoneOffset = (timezone: string): number => {
  const timezoneOffsets: { [key: string]: number } = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Amsterdam': 1,
    'Asia/Dubai': 4,
    'Asia/Karachi': 5,
    'Asia/Dhaka': 6,
    'Asia/Jakarta': 7,
    'Asia/Shanghai': 8,
    'Asia/Tokyo': 9,
    'Australia/Sydney': 11,
  };
  
  return timezoneOffsets[timezone] || 0;
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log('=== Prayer Times Request ===');
  console.log('Method:', req.method);
  console.log('Origin:', origin);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 100 requests per hour.' 
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Periodic cleanup (every 100th request)
    if (Math.random() < 0.01) {
      cleanupRateLimitMap();
    }
    const body = await req.json();
    console.log('Request body:', body);
    
    const { latitude, longitude } = body;
    
    if (!latitude || !longitude) {
      console.error('Missing coordinates:', { latitude, longitude });
      throw new Error('Latitude and longitude are required');
    }

    console.log(`Fetching prayer times for coordinates: ${latitude}, ${longitude}`);

    // Get current date in YYYY-MM-DD format using UTC to avoid timezone issues
    const now = new Date();
    const currentDate = now.getUTCFullYear() + '-' + 
      String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getUTCDate()).padStart(2, '0');
    
    console.log(`Using date: ${currentDate} (UTC: ${now.toISOString()})`);
    
    // Use AlAdhan API with timezone detection and proper method
    const apiUrl = `https://api.aladhan.com/v1/timings/${currentDate}?latitude=${latitude}&longitude=${longitude}&method=2`;
    
    console.log(`API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`Prayer times API error: ${response.status} - ${errorText}`);
    }

    const apiData = await response.json();
    
    if (apiData.code !== 200) {
      console.error(`API returned error code: ${apiData.code}`, apiData);
      throw new Error(`Invalid response from prayer times API: ${apiData.status || 'Unknown error'}`);
    }

    const timings = apiData.data.timings;
    const meta = apiData.data.meta;
    
    console.log(`API Response meta:`, meta);
    console.log(`Raw timings:`, timings);
    
    // Convert 24h format to 12h format
    const convertTo12Hour = (time24: string): string => {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };

    // Create prayer times array (excluding Sunrise)
    const prayerTimes: PrayerTime[] = [
      { name: 'Fajr', time: convertTo12Hour(timings.Fajr), arabic: prayerNames.fajr.arabic },
      { name: 'Dhuhr', time: convertTo12Hour(timings.Dhuhr), arabic: prayerNames.dhuhr.arabic },
      { name: 'Asr', time: convertTo12Hour(timings.Asr), arabic: prayerNames.asr.arabic },
      { name: 'Maghrib', time: convertTo12Hour(timings.Maghrib), arabic: prayerNames.maghrib.arabic },
      { name: 'Isha', time: convertTo12Hour(timings.Isha), arabic: prayerNames.isha.arabic },
    ];

    // Calculate current time in the location's timezone
    // Get timezone offset from timezone string
    const timezone = meta.timezone || 'UTC';
    const now2 = new Date();
    const utcTime = now2.getTime() + (now2.getTimezoneOffset() * 60000);
    const targetTime = new Date(utcTime + (getTimezoneOffset(timezone) * 3600000));
    const currentHour = targetTime.getHours();
    const currentMinute = targetTime.getMinutes();
    
    console.log(`Timezone: ${timezone}`);
    console.log(`Local time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
    
    let currentPrayer = 'Isha'; // Default to Isha (night period)
    let nextPrayer = 'Fajr';
    
    // Convert prayer times to minutes for comparison
    const timeToMinutes = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let totalMinutes = minutes + (hours % 12) * 60;
      if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
      if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
      return totalMinutes;
    };
    
    const currentMinutes = currentHour * 60 + currentMinute;
    
    const prayerMinutes = {
      Fajr: timeToMinutes(prayerTimes[0].time),
      Dhuhr: timeToMinutes(prayerTimes[1].time),
      Asr: timeToMinutes(prayerTimes[2].time),
      Maghrib: timeToMinutes(prayerTimes[3].time),
      Isha: timeToMinutes(prayerTimes[4].time),
    };
    
    console.log('Current time:', `${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentMinutes} minutes)`);
    console.log('Prayer times in minutes:', prayerMinutes);
    
    // Determine current prayer period (what prayer time has passed most recently)
    if (currentMinutes < prayerMinutes.Fajr) {
      // Before Fajr - we're in Isha period from previous day
      currentPrayer = 'Isha';
      nextPrayer = 'Fajr';
    } else if (currentMinutes < prayerMinutes.Dhuhr) {
      // After Fajr but before Dhuhr - we're in Fajr period
      currentPrayer = 'Fajr';
      nextPrayer = 'Dhuhr';
    } else if (currentMinutes < prayerMinutes.Asr) {
      // After Dhuhr but before Asr - we're in Dhuhr period
      currentPrayer = 'Dhuhr';
      nextPrayer = 'Asr';
    } else if (currentMinutes < prayerMinutes.Maghrib) {
      // After Asr but before Maghrib - we're in Asr period
      currentPrayer = 'Asr';
      nextPrayer = 'Maghrib';
    } else if (currentMinutes < prayerMinutes.Isha) {
      // After Maghrib but before Isha - we're in Maghrib period
      currentPrayer = 'Maghrib';
      nextPrayer = 'Isha';
    } else {
      // After Isha - we're in Isha period, next is tomorrow's Fajr
      currentPrayer = 'Isha';
      nextPrayer = 'Fajr';
    }
    
    // Calculate time until next prayer
    let nextPrayerMinutes = prayerMinutes[nextPrayer as keyof typeof prayerMinutes];
    if (nextPrayer === 'Fajr' && currentMinutes >= prayerMinutes.Isha) {
      nextPrayerMinutes += 24 * 60; // Add 24 hours for tomorrow's Fajr
    }
    
    const minutesUntilNext = nextPrayerMinutes - currentMinutes;
    const hoursUntilNext = Math.floor(minutesUntilNext / 60);
    const minsUntilNext = minutesUntilNext % 60;
    
    let timeUntilNext = '';
    if (hoursUntilNext > 0) {
      timeUntilNext = `${hoursUntilNext}h ${minsUntilNext}m`;
    } else {
      timeUntilNext = `${minsUntilNext}m`;
    }

    // Format our calculated date properly instead of using API's incorrect date
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${String(now.getUTCDate()).padStart(2, '0')} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
    
    console.log(`API returned date: ${apiData.data.date.readable}, using our calculated date: ${formattedDate}`);

    const result: PrayerTimesResponse = {
      prayerTimes,
      currentPrayer,
      nextPrayer,
      timeUntilNext,
      location: meta.timezone || 'Local Time',
      date: formattedDate,
    };

    console.log('Prayer times calculated successfully:', {
      prayerCount: result.prayerTimes.length,
      currentPrayer: result.currentPrayer,
      nextPrayer: result.nextPrayer,
      timeUntilNext: result.timeUntilNext
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('=== Prayer Times Error ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Check edge function logs for more information'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});