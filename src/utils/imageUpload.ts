import { supabase } from "@/integrations/supabase/client";

export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  thumbnail: 200 * 1024, // 200KB
};

/**
 * Compress an image to target size while maintaining aspect ratio
 */
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        file.type === "image/png" ? "image/png" : "image/jpeg",
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Generate a thumbnail for preview
 */
export const generateThumbnail = async (
  file: File,
  size = 200
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(size / width, size / height);
      const newWidth = width * scale;
      const newHeight = height * scale;

      canvas.width = size;
      canvas.height = size;

      // Center the image
      const x = (size - newWidth) / 2;
      const y = (size - newHeight) / 2;

      ctx?.drawImage(img, x, y, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        "image/jpeg",
        0.7
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Get image dimensions
 */
export const getImageDimensions = (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): boolean => {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!validTypes.includes(file.type)) {
    return false;
  }
  if (file.size > FILE_SIZE_LIMITS.image) {
    return false;
  }
  return true;
};

/**
 * Upload image with thumbnail to Supabase storage
 */
export const uploadImage = async (
  imageBlob: Blob,
  thumbnailBlob: Blob,
  messageId: string,
  userId: string,
  originalFile: File
): Promise<{ imageUrl: string; thumbnailUrl: string; metadata: any }> => {
  const timestamp = Date.now();
  const imagePath = `${userId}/${messageId}-${timestamp}.jpg`;
  const thumbnailPath = `${userId}/thumbs/${messageId}-${timestamp}-thumb.jpg`;

  // Upload main image
  const { data: imageData, error: imageError } = await supabase.storage
    .from("message-attachments")
    .upload(imagePath, imageBlob, {
      contentType: "image/jpeg",
      cacheControl: "31536000", // 1 year
    });

  if (imageError) throw imageError;

  // Upload thumbnail
  const { data: thumbnailData, error: thumbnailError } = await supabase.storage
    .from("message-attachments")
    .upload(thumbnailPath, thumbnailBlob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });

  if (thumbnailError) throw thumbnailError;

  // Get signed URLs
  const { data: imageUrlData } = await supabase.storage
    .from("message-attachments")
    .createSignedUrl(imagePath, 31536000); // 1 year

  const { data: thumbnailUrlData } = await supabase.storage
    .from("message-attachments")
    .createSignedUrl(thumbnailPath, 31536000);

  const dimensions = await getImageDimensions(originalFile);
  const compressionRatio = imageBlob.size / originalFile.size;

  return {
    imageUrl: imageUrlData?.signedUrl || "",
    thumbnailUrl: thumbnailUrlData?.signedUrl || "",
    metadata: {
      width: dimensions.width,
      height: dimensions.height,
      originalSize: originalFile.size,
      compressedSize: imageBlob.size,
      compressionRatio,
    },
  };
};
