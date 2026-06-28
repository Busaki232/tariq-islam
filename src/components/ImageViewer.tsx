import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useState } from "react";

interface ImageViewerProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
}

export const ImageViewer = ({
  imageUrl,
  isOpen,
  onClose,
  fileName = "image.jpg",
}: ImageViewerProps) => {
  const [loading, setLoading] = useState(true);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="relative bg-black">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={handleDownload}
              className="bg-background/80 backdrop-blur"
              type="button"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={onClose}
              className="bg-background/80 backdrop-blur"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-center min-h-[400px] max-h-[80vh] p-4">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">
                  Loading...
                </div>
              </div>
            )}
            <img
              src={imageUrl}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain touch-auto"
              onLoad={() => setLoading(false)}
              style={{ display: loading ? "none" : "block" }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
