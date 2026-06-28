// Cloudflare Turnstile configuration
// Turnstile provides invisible bot protection with privacy-first design
//
// PRODUCTION SETUP:
// ========================================
// ✅ Site Key configured below (public - safe to commit)
// ✅ Secret Key must be added to Supabase Dashboard:
//    - Go to: Supabase Dashboard → Authentication → Bot Protection
//    - Enable "Cloudflare Turnstile protection"
//    - Add your Turnstile secret key
//    - Configure for "Sign up" and "Sign in" actions
// ✅ Test thoroughly before going live!

import { Capacitor } from "@capacitor/core";

// Cloudflare's official test site key (always passes, works on any domain)
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

// Production site key
const TURNSTILE_PROD_SITE_KEY = "0x4AAAAAACHhEiDNgWhFJxjB";

// Check if running in development (not production domain)
const isDevEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  return !hostname.includes("global-muslims-connect.com");
};

// Reliable native app detection (Android/iOS via Capacitor)
const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

// Captcha should be disabled in native apps (Turnstile doesn't work in WebView)
export const isCaptchaEnabled = (): boolean => {
  const native = isNativeApp();
  console.log("[Turnstile] isCaptchaEnabled → native:", native);
  return !native;
};

// Static constant for backward compatibility
export const CAPTCHA_ENABLED = !isNativeApp();

// Use test key for development/preview, production key for live site
export const TURNSTILE_SITE_KEY = isDevEnvironment()
  ? TURNSTILE_TEST_SITE_KEY
  : TURNSTILE_PROD_SITE_KEY;

// For more info: https://dash.cloudflare.com/turnstile