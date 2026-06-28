// Production-safe logging utility
const isDevelopment = import.meta.env.DEV;

function shouldSuppress(message: string, data?: any) {
  const msg = (message || "").toLowerCase();

  let dataStr = "";
  try {
    if (data) dataStr = JSON.stringify(data).toLowerCase();
  } catch {
    // ignore stringify errors
  }

  const haystack = `${msg} ${dataStr}`;

  // Suppress known Supabase / Voice noise
  if (haystack.includes("object not found")) return true;
  if (haystack.includes("not_found")) return true;
  if (haystack.includes("failed to generate signed url")) return true;
  if (haystack.includes("/storage/v1/object/sign/")) return true;
  if (haystack.includes("voiceplayer")) return true;

  return false;
}

export const logger = {
  info: (message: string, data?: any) => {
    if (!isDevelopment) return;
    if (shouldSuppress(message, data)) return;

    if (data !== undefined) {
      console.log(`[INFO] ${message}`, data);
    } else {
      console.log(`[INFO] ${message}`);
    }
  },

  warn: (message: string, data?: any) => {
    if (!isDevelopment) return;
    if (shouldSuppress(message, data)) return;

    if (data !== undefined) {
      console.warn(`[WARN] ${message}`, data);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  error: (message: string, error?: any) => {
    if (!isDevelopment) return;
    if (shouldSuppress(message, error)) return;

    if (error !== undefined) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  debug: (message: string, data?: any) => {
    if (!isDevelopment) return;
    if (shouldSuppress(message, data)) return;

    if (data !== undefined) {
      console.debug(`[DEBUG] ${message}`, data);
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  },
};