import { Capacitor } from "@capacitor/core";

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

/**
 * Check if running in a native Capacitor environment
 */
export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Get the current platform
 */
export const getPlatform = (): string => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
};

/**
 * IMPORTANT:
 * Do NOT return Capacitor plugin proxies (Camera, Filesystem, etc.) directly from an async function.
 * Some plugin proxies are "thenable" and Promise-resolution will call `.then()`, causing:
 *   "Camera.then() is not implemented on android"
 *
 * Always wrap them in a plain object before returning.
 */
type CameraModule = {
  Camera: any;
};

type FilesystemModule = {
  Filesystem: any;
  Directory: any;
};

/**
 * Safely get Camera plugin with error handling
 */
const getCameraPlugin = async (): Promise<CameraModule | null> => {
  try {
    const mod = await import("@capacitor/camera");
    return { Camera: mod.Camera }; // wrapper avoids thenable assimilation
  } catch (error) {
    console.warn("[NativePermissions] Camera plugin not available:", error);
    return null;
  }
};

/**
 * Safely get Filesystem plugin with error handling
 */
const getFilesystemPlugin = async (): Promise<FilesystemModule | null> => {
  try {
    const mod = await import("@capacitor/filesystem");
    return { Filesystem: mod.Filesystem, Directory: mod.Directory }; // wrapper avoids thenable assimilation
  } catch (error) {
    console.warn("[NativePermissions] Filesystem plugin not available:", error);
    return null;
  }
};

/**
 * Request camera permission using browser API (works on web and also inside Capacitor WebView)
 * This is safe and avoids Capacitor Camera.then issues for permission prompts.
 */
const requestCameraViaGetUserMedia = async (): Promise<PermissionStatus> => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("[NativePermissions] getUserMedia not available");
      return { granted: false, denied: false, prompt: true };
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true, denied: false, prompt: false };
  } catch (error: any) {
    console.error("[NativePermissions] Camera permission denied:", error);
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      return { granted: false, denied: true, prompt: false };
    }
    return { granted: false, denied: false, prompt: true };
  }
};

/**
 * Request microphone permission (browser API)
 */
export const requestMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("[NativePermissions] getUserMedia not available");
      return { granted: false, denied: false, prompt: true };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true, denied: false, prompt: false };
  } catch (error: any) {
    console.error("[NativePermissions] Microphone permission error:", error);

    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      return { granted: false, denied: true, prompt: false };
    }

    return { granted: false, denied: false, prompt: true };
  }
};

/**
 * Request camera permission using Capacitor (but safely)
 * For Android: use getUserMedia to avoid Camera.then crashes during permission checks.
 */
export const requestCameraPermission = async (): Promise<PermissionStatus> => {
  const platform = getPlatform();

  // Web always uses browser permission
  if (!isNativePlatform()) {
    return await requestCameraViaGetUserMedia();
  }

  // Android: avoid Camera.checkPermissions/requestPermissions to prevent Camera.then crash chains
  if (platform === "android") {
    return await requestCameraViaGetUserMedia();
  }

  // iOS (and other): Camera plugin permission flow is OK
  try {
    const camMod = await getCameraPlugin();
    if (!camMod) {
      console.warn("[NativePermissions] Camera plugin unavailable, falling back to getUserMedia");
      return await requestCameraViaGetUserMedia();
    }

    const Camera = camMod.Camera;
    const permissions = await Camera.checkPermissions();

    if (permissions.camera === "granted") return { granted: true, denied: false, prompt: false };

    const requested = await Camera.requestPermissions({ permissions: ["camera"] });
    return {
      granted: requested.camera === "granted",
      denied: requested.camera === "denied",
      prompt: requested.camera === "prompt",
    };
  } catch (error) {
    console.error("[NativePermissions] Error requesting camera permission:", error);
    // fallback
    return await requestCameraViaGetUserMedia();
  }
};

/**
 * Request photo library/gallery permission
 * Android: we skip explicit "photos" permission check here (varies by OS/version) and let picker handle it.
 */
export const requestPhotoLibraryPermission = async (): Promise<PermissionStatus> => {
  const platform = getPlatform();

  if (!isNativePlatform()) {
    return { granted: true, denied: false, prompt: false };
  }

  // Android photo permission behavior differs by API level; avoid brittle Camera.checkPermissions photos path
  if (platform === "android") {
    return { granted: true, denied: false, prompt: false };
  }

  try {
    const camMod = await getCameraPlugin();
    if (!camMod) {
      console.warn("[NativePermissions] Camera plugin unavailable for photo library, assuming granted");
      return { granted: true, denied: false, prompt: false };
    }

    const Camera = camMod.Camera;
    const permissions = await Camera.checkPermissions();

    if (permissions.photos === "granted") return { granted: true, denied: false, prompt: false };

    const requested = await Camera.requestPermissions({ permissions: ["photos"] });
    return {
      granted: requested.photos === "granted",
      denied: requested.photos === "denied",
      prompt: requested.photos === "prompt",
    };
  } catch (error) {
    console.error("[NativePermissions] Error requesting photo library permission:", error);
    return { granted: true, denied: false, prompt: false };
  }
};

/**
 * Request filesystem/storage permission using Capacitor
 */
export const requestStoragePermission = async (): Promise<PermissionStatus> => {
  if (!isNativePlatform()) {
    return { granted: true, denied: false, prompt: false };
  }

  try {
    const fsMod = await getFilesystemPlugin();
    if (!fsMod) {
      console.warn("[NativePermissions] Filesystem plugin unavailable, assuming granted");
      return { granted: true, denied: false, prompt: false };
    }

    const { Filesystem, Directory } = fsMod;

    const testFile = `permission_test_${Date.now()}.txt`;

    await Filesystem.writeFile({
      path: testFile,
      data: "test",
      directory: Directory.Cache,
    });

    await Filesystem.deleteFile({
      path: testFile,
      directory: Directory.Cache,
    });

    return { granted: true, denied: false, prompt: false };
  } catch (error) {
    console.error("[NativePermissions] Storage permission error:", error);
    return { granted: false, denied: true, prompt: false };
  }
};

/**
 * Pick an image from gallery using Capacitor Camera
 */
export const pickImageFromGallery = async (): Promise<{ dataUrl: string; format: string } | null> => {
  try {
    const camMod = await getCameraPlugin();
    if (!camMod) {
      console.error("[NativePermissions] Camera plugin not available for gallery");
      return null;
    }

    const Camera = camMod.Camera;
    const { CameraResultType, CameraSource } = await import("@capacitor/camera");

    if (isNativePlatform() && getPlatform() !== "android") {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        console.error("[NativePermissions] Photo library permission not granted");
        return null;
      }
    }

    const image = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      quality: 90,
    });

    if (image?.dataUrl) {
      return { dataUrl: image.dataUrl, format: image.format };
    }

    return null;
  } catch (error) {
    console.error("[NativePermissions] Error picking image from gallery:", error);
    return null;
  }
};

/**
 * Take a photo using device camera via Capacitor
 */
export const takePhoto = async (): Promise<{ dataUrl: string; format: string } | null> => {
  try {
    const camMod = await getCameraPlugin();
    if (!camMod) {
      console.error("[NativePermissions] Camera plugin not available");
      return null;
    }

    const Camera = camMod.Camera;
    const { CameraResultType, CameraSource } = await import("@capacitor/camera");

    // Permission: Android uses getUserMedia (safe), iOS uses Camera permissions
    if (isNativePlatform()) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        console.error("[NativePermissions] Camera permission not granted");
        return null;
      }
    }

    const image = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 90,
    });

    if (image?.dataUrl) {
      return { dataUrl: image.dataUrl, format: image.format };
    }

    return null;
  } catch (error) {
    console.error("[NativePermissions] Error taking photo:", error);
    return null;
  }
};

/**
 * Convert a data URL to a File object
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

/**
 * Request all media permissions at once
 */
export const requestAllMediaPermissions = async (): Promise<{
  camera: PermissionStatus;
  microphone: PermissionStatus;
  storage: PermissionStatus;
}> => {
  const [camera, microphone, storage] = await Promise.all([
    requestCameraPermission(),
    requestMicrophonePermission(),
    requestStoragePermission(),
  ]);

  return { camera, microphone, storage };
};