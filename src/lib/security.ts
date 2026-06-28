import DOMPurify from "dompurify";
import { logger } from "./logger";

/**
 * Security utilities for input sanitization and validation
 */
export class SecurityUtils {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHtml(html: string): string {
    if (typeof window === "undefined") return html;

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Validate and sanitize text input
   */
  static sanitizeText(text: string): string {
    return text.trim().slice(0, 1000);
  }

  /**
   * Check if string contains potentially malicious patterns
   */
  static containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Rate limiting tracker for security operations
   */
  private static rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();

  /**
   * Check if operation is rate limited
   */
  static checkRateLimit(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 60000
  ): boolean {
    const now = Date.now();
    const existing = this.rateLimitMap.get(key);

    if (!existing || now > existing.resetTime) {
      this.rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }

    if (existing.count >= maxAttempts) {
      logger.warn(`Rate limit exceeded for key: ${key}`);
      return true;
    }

    existing.count++;
    return false;
  }

  /**
   * Clear rate limit for a key (useful for successful operations)
   */
  static clearRateLimit(key: string): void {
    this.rateLimitMap.delete(key);
  }

  /**
   * Log security events for monitoring
   */
  static logSecurityEvent(
    event: string,
    details?: Record<string, unknown>
  ): void {
    logger.info(`[SECURITY] ${event}`, {
      timestamp: new Date().toISOString(),
      userAgent:
        typeof window !== "undefined"
          ? window.navigator.userAgent
          : "server",
      ...(details ?? {}),
    });
  }
}

/**
 * Enhanced input validation with security checks
 */
export const secureValidation = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      emailRegex.test(email) && !SecurityUtils.containsSuspiciousPatterns(email)
    );
  },

  url: (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return (
        ["http:", "https:"].includes(urlObj.protocol) &&
        !SecurityUtils.containsSuspiciousPatterns(url)
      );
    } catch {
      return false;
    }
  },

  phone: (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ""));
  },
};