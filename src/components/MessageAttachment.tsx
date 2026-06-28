import { ImageAttachment } from "./ImageAttachment";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

interface Attachment {
  id: string;
  file_type: string;
  file_url: string;
  thumbnail_url?: string | null;
  file_name: string;
  file_size: number;
  metadata?: {
    width?: number;
    height?: number;
    originalSize?: number;
    duration?: number;
    mimeType?: string;
    kind?: string;
    fileName?: string;
  };
}

interface MessageAttachmentProps {
  attachment: Attachment;
}

export const MessageAttachment = ({ attachment }: MessageAttachmentProps) => {
  const isVoice =
    attachment.file_type === "voice" ||
    attachment.file_type === "audio" ||
    attachment.metadata?.kind === "voice" ||
    attachment.metadata?.mimeType?.startsWith("audio/") ||
    attachment.file_url?.match(/\.(webm|mp3|wav|m4a|ogg)(\?|$)/i);

  const isVideo =
    !isVoice &&
    (
      attachment.file_type === "video" ||
      attachment.metadata?.kind === "video" ||
      attachment.metadata?.mimeType?.startsWith("video/") ||
      attachment.file_url?.match(/\.(mp4|mov|m4v)(\?|$)/i)
    );

  if (isVideo) {
    return (
      <div className="mt-3 w-full overflow-hidden rounded-2xl border bg-black shadow-sm">
        <video
          src={attachment.file_url}
          controls
          playsInline
          preload="metadata"
          poster={attachment.thumbnail_url || undefined}
          className="w-full aspect-video max-h-[420px] bg-black object-cover"
        />
      </div>
    );
  }

  if (isVoice) {
    return (
      <div className="mt-3 w-full max-w-md rounded-2xl border bg-green-50 px-4 py-3 shadow-sm">
        <VoiceMessagePlayer
          audioUrl={attachment.file_url}
          duration={attachment.metadata?.duration}
        />
      </div>
    );
  }

  switch (attachment.file_type) {
    case "image":
      return (
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <ImageAttachment
            imageUrl={attachment.file_url}
            thumbnailUrl={attachment.thumbnail_url || undefined}
            metadata={attachment.metadata}
            fileName={attachment.file_name}
          />
        </div>
      );

    default:
      return (
        <a
          href={attachment.file_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-xl border px-3 py-2 text-sm text-primary underline"
        >
          Open attachment
        </a>
      );
  }
};

export default MessageAttachment;