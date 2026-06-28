/**
 * Security Headers Configuration
 *
 * This configuration defines security headers that should be applied
 * to protect against common web vulnerabilities.
 *
 * Note: These headers need to be configured in your hosting platform
 * (Netlify, Vercel, etc.) or web server configuration.
 */

export const SECURITY_HEADERS = {
  // Content Security Policy - Prevents XSS attacks
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Enforce HTTPS
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

  // Clickjacking protection
  "X-Frame-Options": "DENY",

  // XSS Protection (legacy browsers)
  "X-XSS-Protection": "1; mode=block",

  // Referrer Policy - Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions Policy - allow camera/mic for your own origin
  "Permissions-Policy": ["camera=(self)", "microphone=(self)", "geolocation=(self)"].join(", "),
};

/**
 * Netlify configuration example (_headers file):
 *
 * /*
 *   Content-Security-Policy: [value from above]
 *   X-Content-Type-Options: nosniff
 *   Strict-Transport-Security: max-age=31536000; includeSubDomains
 *   X-Frame-Options: DENY
 *   X-XSS-Protection: 1; mode=block
 *   Referrer-Policy: strict-origin-when-cross-origin
 *   Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)
 */