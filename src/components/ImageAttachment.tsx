import { useState } from "react";
import { ImageViewer } from "./ImageViewer";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageAttachmentProps {
  imageUrl: string;
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    originalSize?: number;
  };
  fileName?: string;
}

export const ImageAttachment = ({
  imageUrl,
  thumbnailUrl,
  metadata,
  fileName,
}: ImageAttachmentProps) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const displayUrl = thumbnailUrl || imageUrl;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="max-w-sm">
        <div
          className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
          onClick={(e) => {
            e.stopPropagation();
            setViewerOpen(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setViewerOpen(true);
          }}
          role="button"
          tabIndex={0}
          aria-label="View image"
        >
          {loading && (
            <Skeleton className="absolute inset-0 w-full h-48" />
          )}
          <img
            src={displayUrl}
            alt="Attachment"
            className={`w-full h-auto rounded-lg select-none ${loading ? "invisible" : "visible"}`}
            onLoad={() => setLoading(false)}
            loading="lazy"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              Tap to view
            </div>
          </div>
        </div>
        {metadata && (
          <div className="text-xs text-muted-foreground mt-1">
            {metadata.width && metadata.height && (
              <span>{metadata.width} × {metadata.height} </span>
            )}
            {metadata.originalSize && (
              <span>• {formatFileSize(metadata.originalSize)}</span>
            )}
          </div>
        )}
      </div>

      <ImageViewer
        imageUrl={imageUrl}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fileName={fileName}
      />
    </>
  );
};
