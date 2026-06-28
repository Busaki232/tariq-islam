/**
 * Central permission helper for camera, microphone, and photo library access.
 * Provides user-friendly error handling with toast notifications.
 *
 * IMPORTANT ANDROID NOTE:
 * On Android WebView, getUserMedia can sometimes hang (never resolves) even after permissions are granted.
 * We wrap getUserMedia in a timeout and if it times out on native Android, we proceed anyway.
 *
 * ALSO IMPORTANT:
 * Do NOT use @capacitor/camera for call permissions. It can trigger "Camera.then() is not implemented on android"
 * in some setups when the plugin object gets treated as a thenable.
 */

import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";

let manifestErrorShown = false;

/**
 * Hard timeout wrapper
 */
const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let t: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
};

export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const getPlatform = (): string => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
};

export const isCapacitorReady = (): boolean => {
  try {
    if (typeof Capacitor === "undefined") return false;
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const waitForCapacitorBridge = async (timeoutMs: number = 1500): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isCapacitorReady()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};

const isMediaDevicesAvailable = (): boolean => {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
};

const isManifestPermissionError = (error: any): boolean => {
  const msg = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  return (
    msg.includes("no permissions requested") ||
    msg.includes("permission not requested") ||
    msg.includes("not declared in manifest") ||
    name.includes("securityerror")
  );
};

const showManifestPermissionError = (permissionType: string): void => {
  if (manifestErrorShown) return;
  manifestErrorShown = true;

  toast.error(`${permissionType} permission not configured`, {
    description: "AndroidManifest is missing required permissions. Rebuild the app after syncing Capacitor.",
    duration: 8000,
  });

  console.error(
    `[Permissions] MANIFEST ERROR: ${permissionType} permission is not declared in AndroidManifest.xml.
Add:
- android.permission.CAMERA
- android.permission.RECORD_AUDIO
- android.permission.INTERNET
Then run: npx cap sync android`
  );
};

/**
 * Low-level getUserMedia request with timeout + Android native fallback.
 * If it times out on native Android, we assume the OS dialog happened and proceed.
 */
const requestUserMedia = async (constraints: MediaStreamConstraints, label: string): Promise<boolean> => {
  if (!isMediaDevicesAvailable()) {
    toast.error("Not supported", {
      description: "Your device does not support camera/microphone access.",
      duration: 5000,
    });
    return false;
  }

  try {
    const stream = await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 8000, label);
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();

    // Android WebView hang: proceed on native
    if (msg.includes("timed out") && isNativePlatform()) {
      console.warn("[Permissions] getUserMedia timed out on native; proceeding.");
      return true;
    }

    if (isManifestPermissionError(err)) {
      showManifestPermissionError("Camera/Microphone");
      return false;
    }

    // Normal browser errors
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      toast.error("Permission denied", {
        description: "Please allow access in device settings to use calls.",
        duration: 6000,
      });
      return false;
    }

    if (err?.name === "NotFoundError") {
      toast.error("No device found", {
        description: "No camera or microphone was detected.",
        duration: 5000,
      });
      return false;
    }

    if (err?.name === "NotReadableError") {
      toast.error("Device busy", {
        description: "Another app may be using the camera/microphone. Close it and try again.",
        duration: 5000,
      });
      return false;
    }

    if (err?.name === "NotSupportedError" || err?.name === "TypeError") {
      toast.error("Not supported", {
        description: "Your device does not support the required media features.",
        duration: 5000,
      });
      return false;
    }

    toast.error("Cannot access media devices", {
      description: err?.message || "Please check permissions and try again.",
      duration: 5000,
    });
    return false;
  }
};

/**
 * Simple helper to request permissions before starting a call.
 */
export async function ensureMediaPermissions(callType: "video" | "audio"): Promise<boolean> {
  console.log("[Permissions] ensureMediaPermissions:", callType);
  if (isNativePlatform()) {
    await waitForCapacitorBridge(1200);
  }

  return requestUserMedia(
    { audio: true, video: callType === "video" },
    `getUserMedia(${callType})`
  );
}

export async function ensureCameraPermission(): Promise<boolean> {
  console.log("[Permissions] ensureCameraPermission");
  if (isNativePlatform()) {
    await waitForCapacitorBridge(1200);
  }
  // Request video only (some browsers require audio true to prompt; but for camera check, video is enough)
  return requestUserMedia({ video: true }, "getUserMedia(video)");
}

export async function ensureMicrophonePermission(): Promise<boolean> {
  console.log("[Permissions] ensureMicrophonePermission");
  if (isNativePlatform()) {
    await waitForCapacitorBridge(1200);
  }
  return requestUserMedia({ audio: true }, "getUserMedia(audio)");
}

/**
 * Photo library permission:
 * On web, file picker does not need extra permission.
 * On native, you can keep this permissive and let ImageUpload handle it.
 * We intentionally do NOT use @capacitor/camera here to avoid the Android Camera.then issue.
 */
export async function ensurePhotoLibraryPermission(): Promise<boolean> {
  console.log("[Permissions] ensurePhotoLibraryPermission");
  return true;
}

export async function ensureVideoCallPermissions(): Promise<boolean> {
  console.log("[Permissions] ensureVideoCallPermissions | Platform:", getPlatform(), "| Native:", isNativePlatform());
  if (isNativePlatform()) {
    await waitForCapacitorBridge(1500);
  }
  return requestUserMedia({ video: true, audio: true }, "getUserMedia(video+audio)");
}

export async function ensureAudioCallPermissions(): Promise<boolean> {
  console.log("[Permissions] ensureAudioCallPermissions | Platform:", getPlatform(), "| Native:", isNativePlatform());
  if (isNativePlatform()) {
    await waitForCapacitorBridge(1500);
  }
  return requestUserMedia({ audio: true }, "getUserMedia(audio)");
}

export function openAppSettings(): void {
  if (isNativePlatform()) {
    toast.info("Open Settings", {
      description: "Settings > Apps > Tariq Islam > Permissions (Camera, Microphone).",
      duration: 8000,
    });
  } else {
    toast.info("Enable Permissions", {
      description: "Check your browser site settings for camera/microphone permissions.",
      duration: 8000,
    });
  }
}

export function resetManifestErrorFlag(): void {
  manifestErrorShown = false;
}