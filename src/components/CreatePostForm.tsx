import { useState } from "react";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContentModeration } from "@/hooks/useContentModeration";

const createPostSchema = z.object({
  content: z.string().trim().min(1, "Write something or add media").max(1000),
  location: z.string().trim().max(100).optional(),
});

type CreatePostData = z.infer<typeof createPostSchema>;

interface CreatePostFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CreatePostForm = ({ onSuccess, onCancel }: CreatePostFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { checkContent, createAutoFlaggedReport } = useContentModeration();

  const form = useForm<CreatePostData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      content: "",
      location: "",
    },
  });

  const setPickedFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
toast({
  title: "Media selected",
  description: `${isVideo ? "Video" : "Photo"} selected: ${Math.round(file.size / 1024 / 1024)}MB`,
});
    if (!isImage && !isVideo) {
      toast({
        title: "Unsupported file",
        description: "Please choose a picture or video.",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleWebMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPickedFile(file);
  };

const pickMedia = async () => {
  try {
    const result = await FilePicker.pickMedia({
      readData: false,
      skipTranscoding: false,
    });

    const picked = result.files?.[0];
    console.log("PICKED:", picked);
    console.log("MIME:", picked?.mimeType);
    console.log("PATH:", picked?.path);
    if (!picked) return;

    console.log("Picked media:", picked);

    const response = await fetch(picked.path!);
    const blob = await response.blob();
    console.log("BLOB TYPE:", blob.type);
    console.log("BLOB SIZE:", blob.size);

    const mime = picked.mimeType || blob.type;
    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");

    if (!isVideo && !isImage) {
      throw new Error(`Unsupported media type: ${mime}`);
    }

    const file = new File([blob], picked.name || `community-${Date.now()}`, {
      type: mime,
    });

    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  } catch (error: any) {
    toast({
      title: "Picker failed",
      description: error?.message || "Could not choose media.",
      variant: "destructive",
    });
  }
};

const uploadMedia = async () => {
  if (!mediaFile || !user) {
    return { mediaUrl: null, type: null };
  }

  const maxVideoSize = 50 * 1024 * 1024; // 50MB
  const maxImageSize = 10 * 1024 * 1024; // 10MB

  if (mediaType === "video" && mediaFile.size > maxVideoSize) {
    throw new Error("Video file too large. Maximum allowed is 50MB.");
  }

  if (mediaType === "image" && mediaFile.size > maxImageSize) {
    throw new Error("Image file too large. Maximum allowed is 10MB.");
  }

  const fileExt =
    mediaFile.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");

  const filePath = `${user.id}/${Date.now()}.${fileExt}`;

  console.log("UPLOADING:", {
    name: mediaFile.name,
    type: mediaFile.type,
    size: mediaFile.size,
  });

  const { error: uploadError } = await supabase.storage
    .from("community-media")
    .upload(filePath, mediaFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: mediaFile.type,
    });

if (uploadError) {
  console.error("UPLOAD ERROR:", uploadError);
  throw uploadError;
}

  const { data } = supabase.storage.from("community-media").getPublicUrl(filePath);

  return {
    mediaUrl: data.publicUrl,
    type: mediaType,
  };
};

  const onSubmit = async (data: CreatePostData) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a post.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const moderationCheck = await checkContent(data.content);

      if (moderationCheck.shouldRedirect && moderationCheck.highestSeverity >= 9) {
        toast({
          title: "Content Blocked",
          description: "Your post contains prohibited content.",
          variant: "destructive",
        });
        window.location.href = "/anti-extremism";
        return;
      }

      const uploaded = await uploadMedia();

      const { data: insertData, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          content: data.content,
          message_type: "community_post",
          location: data.location || null,
          media_url: uploaded.mediaUrl,
          media_type: uploaded.type,
        })
        .select()
        .single();

      if (error) throw error;

      if (moderationCheck.isFlagged && insertData) {
        await createAutoFlaggedReport(
          user.id,
          "post",
          insertData.id,
          data.content,
          moderationCheck.keywords
        );
      }

      toast({
        title: "Post Created",
        description: "Your community post has been shared.",
      });

      form.reset();
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create post.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="px-3 py-3">
        <CardTitle className="text-base">Share with Community</CardTitle>
        <CardDescription className="text-xs">
          Post comments, pictures, or short videos
        </CardDescription>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Caption</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share something with the community..."
                      className="min-h-[76px] text-sm px-2 py-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1">
              <FormLabel className="text-xs">Add Picture or Video</FormLabel>

              <Button
                type="button"
                variant="outline"
                onClick={pickMedia}
                className="mt-1 h-8 w-full text-xs"
              >
                <ImagePlus className="mr-2 h-3.5 w-3.5" />
                Choose Photo or Video
              </Button>

              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleWebMediaSelect}
                className="mt-1 h-8 text-xs"
              />

              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ImagePlus className="h-3.5 w-3.5" />
                Photos and videos supported
              </div>

              {mediaPreview && mediaType === "image" && (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="mt-2 max-h-32 w-full rounded-md object-cover"
                />
              )}

              {mediaPreview && mediaType === "video" && (
                <video
                  src={mediaPreview}
                  controls
                  playsInline
                  className="mt-2 max-h-32 w-full rounded-md bg-black"
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Location Optional</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Chicago, IL"
                      className="h-8 text-sm px-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 flex-1 text-xs"
              >
                {isSubmitting ? "Posting..." : "Share Post"}
              </Button>

              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CreatePostForm;
