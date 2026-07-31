import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Upload,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ScholarProfileRecord = {
  id: string;
  user_id: string;
  display_name: string;
  verification_status: string;
  is_active: boolean;
};

const UploadScholarLecture = () => {
  const navigate = useNavigate();
  const { scholarId } = useParams<{ scholarId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [scholar, setScholar] =
    useState<ScholarProfileRecord | null>(null);

  const [loadingScholar, setLoadingScholar] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("English");
  const [isFeatured, setIsFeatured] = useState(false);

  const [videoFile, setVideoFile] =
    useState<File | null>(null);

  const [thumbnailFile, setThumbnailFile] =
    useState<File | null>(null);

  useEffect(() => {
    const loadScholar = async () => {
      if (!scholarId || !user?.id) {
        setLoadingScholar(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("scholar_profiles")
          .select(
            `
              id,
              user_id,
              display_name,
              verification_status,
              is_active
            `
          )
          .eq("id", scholarId)
          .eq("user_id", user.id)
          .eq("verification_status", "approved")
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setScholar(
          (data as ScholarProfileRecord | null) ?? null
        );
      } catch (error) {
        console.error(
          "Unable to verify scholar ownership:",
          error
        );

        toast({
          title: t("scholars.uploadLecture.openError", {
            defaultValue:
              "Unable to open lecture studio",
          }),
          description: t(
            "scholars.uploadLecture.openErrorDescription",
            {
              defaultValue:
                "We could not verify this scholar account.",
            }
          ),
          variant: "destructive",
        });
      } finally {
        setLoadingScholar(false);
      }
    };

    void loadScholar();
  }, [scholarId, user?.id, toast, t]);

  const sanitizeFileName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/-+/g, "-");
  };

  const uploadFile = async (
    bucket: string,
    file: File,
    folder: string
  ) => {
    const safeName = sanitizeFileName(file.name);

    const path =
      `${folder}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } =
      await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast({
        title: t(
          "scholars.uploadLecture.titleRequired",
          {
            defaultValue: "Title required",
          }
        ),
        description: t(
          "scholars.uploadLecture.titleRequiredDescription",
          {
            defaultValue:
              "Enter a title for the lecture.",
          }
        ),
        variant: "destructive",
      });

      return false;
    }

    if (!category) {
      toast({
        title: t(
          "scholars.uploadLecture.categoryRequired",
          {
            defaultValue: "Category required",
          }
        ),
        description: t(
          "scholars.uploadLecture.categoryRequiredDescription",
          {
            defaultValue:
              "Select a lecture category.",
          }
        ),
        variant: "destructive",
      });

      return false;
    }

    if (!videoFile) {
      toast({
        title: t(
          "scholars.uploadLecture.videoRequired",
          {
            defaultValue: "Video required",
          }
        ),
        description: t(
          "scholars.uploadLecture.videoRequiredDescription",
          {
            defaultValue:
              "Select a lecture video.",
          }
        ),
        variant: "destructive",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = async (
    status: "draft" | "pending"
  ) => {
    if (!scholar || !user?.id || !scholarId) {
      toast({
        title: t(
          "scholars.uploadLecture.accessRequired",
          {
            defaultValue:
              "Scholar access required",
          }
        ),
        description: t(
          "scholars.uploadLecture.accessRequiredDescription",
          {
            defaultValue:
              "Only the approved scholar can publish here.",
          }
        ),
        variant: "destructive",
      });

      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const videoUrl = await uploadFile(
        "scholar-lectures",
        videoFile as File,
        scholarId
      );

      let thumbnailUrl: string | null = null;

      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(
          "scholar-thumbnails",
          thumbnailFile,
          scholarId
        );
      }

      const { error } = await supabase
        .from("scholar_lectures")
        .insert({
          scholar_id: scholarId,
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          category,
          language,
          is_featured: isFeatured,
          status,
        });

      if (error) {
        throw error;
      }

      toast({
        title:
          status === "pending"
            ? t(
                "scholars.uploadLecture.submitted",
                {
                  defaultValue:
                    "Lecture submitted for review",
                }
              )
            : t(
                "scholars.uploadLecture.draftSaved",
                {
                  defaultValue: "Draft saved",
                }
              ),
        description:
          status === "pending"
            ? t(
                "scholars.uploadLecture.submittedDescription",
                {
                  defaultValue:
                    "An administrator will review your lecture before it appears publicly.",
                }
              )
            : t(
                "scholars.uploadLecture.draftSavedDescription",
                {
                  defaultValue:
                    "Your lecture draft has been saved.",
                }
              ),
      });

      navigate(`/scholars/${scholarId}`);
    } catch (error: any) {
      console.error(
        "Lecture upload failed:",
        error
      );

      toast({
        title: t(
          "scholars.uploadLecture.uploadError",
          {
            defaultValue: "Upload failed",
          }
        ),
        description:
          error?.message ||
          t(
            "scholars.uploadLecture.uploadErrorDescription",
            {
              defaultValue:
                "The lecture could not be uploaded. Please try again.",
            }
          ),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingScholar) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />

            <span>
              {t(
                "scholars.uploadLecture.loading",
                {
                  defaultValue:
                    "Loading lecture studio...",
                }
              )}
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">
                {t(
                  "scholars.uploadLecture.signInFirst",
                  {
                    defaultValue:
                      "Please sign in first.",
                  }
                )}
              </p>

              <Button
                type="button"
                className="mt-4"
                onClick={() => navigate("/auth")}
              >
                {t(
                  "scholars.uploadLecture.signIn",
                  {
                    defaultValue: "Sign In",
                  }
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!scholar) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">
                {t(
                  "scholars.uploadLecture.noPermission",
                  {
                    defaultValue:
                      "You do not have permission to upload lectures for this channel.",
                  }
                )}
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() =>
                  navigate("/scholars")
                }
              >
                {t(
                  "scholars.uploadLecture.returnToScholars",
                  {
                    defaultValue:
                      "Return to Scholars",
                  }
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            navigate(`/scholars/${scholarId}`)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />

          {t(
            "scholars.uploadLecture.backToChannel",
            {
              defaultValue: "Back to Channel",
            }
          )}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>
              {t(
                "scholars.uploadLecture.pageTitle",
                {
                  defaultValue:
                    "Upload Scholar Lecture",
                }
              )}
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              {t(
                "scholars.uploadLecture.publishingAs",
                {
                  scholar: scholar.display_name,
                  defaultValue:
                    "Publishing as {{scholar}}",
                }
              )}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="lecture-title">
                {t(
                  "scholars.uploadLecture.titleLabel",
                  {
                    defaultValue: "Title",
                  }
                )}
              </Label>

              <Input
                id="lecture-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder={t(
                  "scholars.uploadLecture.titlePlaceholder",
                  {
                    defaultValue:
                      "Enter lecture title",
                  }
                )}
                maxLength={150}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lecture-description">
                {t(
                  "scholars.uploadLecture.descriptionLabel",
                  {
                    defaultValue:
                      "Description",
                  }
                )}
              </Label>

              <Textarea
                id="lecture-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder={t(
                  "scholars.uploadLecture.descriptionPlaceholder",
                  {
                    defaultValue:
                      "Describe this lecture",
                  }
                )}
                rows={5}
                maxLength={2000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  {t(
                    "scholars.uploadLecture.categoryLabel",
                    {
                      defaultValue: "Category",
                    }
                  )}
                </Label>

                <Select
                  value={category}
                  onValueChange={setCategory}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "scholars.uploadLecture.categoryPlaceholder",
                        {
                          defaultValue:
                            "Select category",
                        }
                      )}
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Quran">
                      {t(
                        "scholars.uploadLecture.categories.quran",
                        {
                          defaultValue: "Quran",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Hadith">
                      {t(
                        "scholars.uploadLecture.categories.hadith",
                        {
                          defaultValue: "Hadith",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Fiqh">
                      {t(
                        "scholars.uploadLecture.categories.fiqh",
                        {
                          defaultValue: "Fiqh",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Aqidah">
                      {t(
                        "scholars.uploadLecture.categories.aqidah",
                        {
                          defaultValue: "Aqidah",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Seerah">
                      {t(
                        "scholars.uploadLecture.categories.seerah",
                        {
                          defaultValue: "Seerah",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Islamic History">
                      {t(
                        "scholars.uploadLecture.categories.islamicHistory",
                        {
                          defaultValue:
                            "Islamic History",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Family">
                      {t(
                        "scholars.uploadLecture.categories.family",
                        {
                          defaultValue: "Family",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Youth">
                      {t(
                        "scholars.uploadLecture.categories.youth",
                        {
                          defaultValue: "Youth",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="General Reminder">
                      {t(
                        "scholars.uploadLecture.categories.generalReminder",
                        {
                          defaultValue:
                            "General Reminder",
                        }
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {t(
                    "scholars.uploadLecture.languageLabel",
                    {
                      defaultValue: "Language",
                    }
                  )}
                </Label>

                <Select
                  value={language}
                  onValueChange={setLanguage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="English">
                      {t(
                        "scholars.uploadLecture.languages.english",
                        {
                          defaultValue: "English",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Arabic">
                      {t(
                        "scholars.uploadLecture.languages.arabic",
                        {
                          defaultValue: "Arabic",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Hausa">
                      {t(
                        "scholars.uploadLecture.languages.hausa",
                        {
                          defaultValue: "Hausa",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="French">
                      {t(
                        "scholars.uploadLecture.languages.french",
                        {
                          defaultValue: "French",
                        }
                      )}
                    </SelectItem>

                    <SelectItem value="Yoruba">
                      {t(
                        "scholars.uploadLecture.languages.yoruba",
                        {
                          defaultValue: "Yorùbá",
                        }
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lecture-video">
                {t(
                  "scholars.uploadLecture.videoLabel",
                  {
                    defaultValue:
                      "Lecture video",
                  }
                )}
              </Label>

              <label
                htmlFor="lecture-video"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center hover:bg-muted/50"
              >
                <Video className="mb-3 h-10 w-10 text-muted-foreground" />

                <span className="font-medium">
                  {videoFile
                    ? videoFile.name
                    : t(
                        "scholars.uploadLecture.chooseVideo",
                        {
                          defaultValue:
                            "Choose lecture video",
                        }
                      )}
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "scholars.uploadLecture.videoFormats",
                    {
                      defaultValue:
                        "MP4, MOV, or WebM",
                    }
                  )}
                </span>
              </label>

              <Input
                id="lecture-video"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(event) =>
                  setVideoFile(
                    event.target.files?.[0] ?? null
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lecture-thumbnail">
                {t(
                  "scholars.uploadLecture.thumbnailLabel",
                  {
                    defaultValue:
                      "Thumbnail image (optional)",
                  }
                )}
              </Label>

              <label
                htmlFor="lecture-thumbnail"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center hover:bg-muted/50"
              >
                <ImagePlus className="mb-3 h-9 w-9 text-muted-foreground" />

                <span className="font-medium">
                  {thumbnailFile
                    ? thumbnailFile.name
                    : t(
                        "scholars.uploadLecture.chooseThumbnail",
                        {
                          defaultValue:
                            "Choose thumbnail image",
                        }
                      )}
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "scholars.uploadLecture.imageFormats",
                    {
                      defaultValue:
                        "JPG, PNG, or WebP",
                    }
                  )}
                </span>
              </label>

              <Input
                id="lecture-thumbnail"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) =>
                  setThumbnailFile(
                    event.target.files?.[0] ?? null
                  )
                }
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Checkbox
                id="featured-lecture"
                checked={isFeatured}
                onCheckedChange={(checked) =>
                  setIsFeatured(checked === true)
                }
              />

              <div>
                <Label htmlFor="featured-lecture">
                  {t(
                    "scholars.uploadLecture.featureLecture",
                    {
                      defaultValue:
                        "Feature this lecture",
                    }
                  )}
                </Label>

                <p className="text-xs text-muted-foreground">
                  {t(
                    "scholars.uploadLecture.featureDescription",
                    {
                      defaultValue:
                        "Featured lectures appear first on the scholar channel.",
                    }
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() =>
                  void handleSubmit("draft")
                }
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}

                {t(
                  "scholars.uploadLecture.saveDraft",
                  {
                    defaultValue: "Save Draft",
                  }
                )}
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={submitting}
                onClick={() =>
                  void handleSubmit("pending")
                }
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}

                {t(
                  "scholars.uploadLecture.submitReview",
                  {
                    defaultValue:
                      "Submit for Review",
                  }
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default UploadScholarLecture;