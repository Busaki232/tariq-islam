import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { compressImage, generateThumbnail, uploadImage } from "@/utils/imageUpload";
import {
  isNativePlatform,
  pickImageFromGallery,
  takePhoto,
  dataUrlToFile,
} from "@/utils/nativePermissions";
import {
  ensureCameraPermission,
  ensurePhotoLibraryPermission,
} from "@/utils/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void;
  onImageRemove: () => void;
  onUploadComplete: (data: {
    imageUrl: string;
    thumbnailUrl: string | null;
    metadata: any;
    reset: () => void;
  }) => void;
  messageId: string;
  userId: string;
  disabled?: boolean;
}

export const ImageUpload = ({
  onImageSelect,
  onImageRemove,
  onUploadComplete,
  messageId,
  userId,
  disabled,
}: ImageUploadProps) => {
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateMediaFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Invalid file. Please select an image or video.");
      return false;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
      toast.error("Image too large. Max size is 10MB.");
      return false;
    }

    if (isVideo && file.size > 50 * 1024 * 1024) {
      toast.error("Video too large. Max size is 50MB.");
      return false;
    }

    return true;
  };

  const selectMedia = (file: File, previewUrl?: string) => {
    if (!validateMediaFile(file)) return;

    const isVideo = file.type.startsWith("video/");
    const url = previewUrl || URL.createObjectURL(file);

    setSelectedMedia(file);
    setMediaType(isVideo ? "video" : "image");
    setPreview(url);
    onImageSelect(file, url);

    toast.success(
      `${isVideo ? "Video" : "Image"} selected: ${Math.round(file.size / 1024 / 1024)}MB`
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectMedia(file);
  };

  const handleNativeGalleryPick = async () => {
    try {
      const hasPermission = await ensurePhotoLibraryPermission();
      if (!hasPermission) return;

      const result = await pickImageFromGallery();
      if (result) {
        const file = dataUrlToFile(result.dataUrl, `image_${Date.now()}.${result.format}`);
        selectMedia(file, result.dataUrl);
      }
    } catch (error) {
      console.error("Error picking media:", error);
      toast.error("Failed to select media. Please try again.");
    }
  };

  const handleNativeCamera = async () => {
    try {
      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) return;

      const result = await takePhoto();
      if (result) {
        const file = dataUrlToFile(result.dataUrl, `photo_${Date.now()}.${result.format}`);
        selectMedia(file, result.dataUrl);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      toast.error("Failed to take photo. Please try again.");
    }
  };

  const handleRemove = () => {
    if (preview && !preview.startsWith("data:")) {
      URL.revokeObjectURL(preview);
    }

    setSelectedMedia(null);
    setPreview("");
    setMediaType(null);
    onImageRemove();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadVideoDirectly = async (file: File) => {
    const fileExt = file.name.split(".").pop() || "mp4";
    const safeName = `${messageId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${safeName}`;

    console.log("VIDEO UPLOAD START:", {
      name: file.name,
      type: file.type,
      size: file.size,
      filePath,
    });

    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "video/mp4",
      });

    if (uploadError) {
      console.error("VIDEO UPLOAD ERROR:", uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from("message-attachments").getPublicUrl(filePath);

    return {
      imageUrl: data.publicUrl,
      thumbnailUrl: null,
      metadata: {
        originalSize: file.size,
        mimeType: file.type || "video/mp4",
        kind: "video",
        fileName: file.name,
      },
    };
  };

  const handleUpload = async () => {
    if (!selectedMedia) return;

    setUploading(true);

    try {
      const isVideo = selectedMedia.type.startsWith("video/");

      if (isVideo) {
        const result = await uploadVideoDirectly(selectedMedia);

        onUploadComplete({
          ...result,
          reset: handleRemove,
        });

        toast.success("Video uploaded successfully");
        return;
      }

      const compressedImage = await compressImage(selectedMedia);
      const thumbnail = await generateThumbnail(selectedMedia);

      const result = await uploadImage(
        compressedImage,
        thumbnail,
        messageId,
        userId,
        selectedMedia
      );

      onUploadComplete({
        ...result,
        reset: handleRemove,
      });

      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Media upload error:", error);

      toast.error(
        error?.message ||
          error?.error ||
          "Failed to upload media"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {!selectedMedia ? (
        isNativePlatform() ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || uploading}
                className="shrink-0"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleNativeCamera}>
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleNativeGalleryPick}>
                <ImagePlus className="h-4 w-4 mr-2" />
                Choose from Gallery
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleImageButtonClick}
            disabled={disabled || uploading}
            className="shrink-0"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
        )
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            {mediaType === "video" ? (
              <video
                src={preview}
                className="h-16 w-16 object-cover rounded bg-black"
                muted
                playsInline
              />
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="h-16 w-16 object-cover rounded"
              />
            )}

            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            size="sm"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : mediaType === "video" ? (
              "Send Video"
            ) : (
              "Send Image"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};