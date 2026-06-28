import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const BUCKET = "message-attachments";

export async function uploadVoiceMessage(
  audioBlob: Blob,
  messageId: string,
  senderId: string,
  mimeType: string = "audio/webm"
): Promise<string> {
  const extension = mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("aac")
    ? "aac"
    : mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mpeg") || mimeType.includes("mp3")
    ? "mp3"
    : "webm";

  const filename = `${senderId}/${messageId}.${extension}`;

  logger.info("[VoiceUpload] Uploading voice message", {
    filename,
    size: audioBlob.size,
    mimeType,
  });

  const { error } = await supabase.storage.from(BUCKET).upload(filename, audioBlob, {
    contentType: mimeType,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    logger.error("[VoiceUpload] Upload failed", error);
    throw new Error(error.message || "Failed to upload voice message");
  }

  return filename;
}

export async function recordVoiceAttachment(
  messageId: string,
  filePath: string,
  mimeType: string,
  fileSize: number,
  senderId: string
): Promise<void> {
  const extension = filePath.split(".").pop() || "webm";

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  const { error } = await supabase.from("message_attachments").insert({
    message_id: messageId,
    file_name: `voice_${Date.now()}.${extension}`,
    file_url: publicUrl,
    thumbnail_url: null,
    file_type: "voice",
    file_size: fileSize,
    uploaded_by: senderId,
    metadata: {
      mimeType,
      kind: "voice",
    },
  });

  if (error) {
    logger.error("[VoiceUpload] Failed to record attachment metadata", error);
    throw new Error(error.message || "Failed to record voice message metadata");
  }
}