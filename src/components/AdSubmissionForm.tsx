// src/components/AdSubmissionForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Category {
  id: string;
  name: string;
  description: string;
}

const normalizeWebsite = (val: string) => (val ?? "").trim();

const isValidWebsiteOrText = (val: string) => {
  const v = normalizeWebsite(val);
  if (!v) return true;

  // If it looks like a URL attempt, validate it
  if (v.includes(".") || v.includes("/")) {
    try {
      // allow "example.com" style by prepending https://
      // eslint-disable-next-line no-new
      new URL(v.startsWith("http") ? v : `https://${v}`);
      return true;
    } catch {
      return false;
    }
  }

  // Otherwise allow any descriptive text (ex: "Coming soon")
  return true;
};

type AdFormData = {
  title: string;
  description: string;
  category_id: string;
  location?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
};

interface AdSubmissionFormProps {
  onSuccess?: () => void;
  mode?: "create" | "edit";
  advertisementId?: string;
  initialData?: Partial<AdFormData>;
  existingImageUrl?: string | null;
}

export const AdSubmissionForm: React.FC<AdSubmissionFormProps> = ({
  onSuccess,
  mode = "create",
  advertisementId,
  initialData,
  existingImageUrl,
}) => {
  const { t } = useTranslation(["ads", "common"]);
  const { toast } = useToast();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepExistingImage, setKeepExistingImage] = useState(!!existingImageUrl);

  const adSchema = useMemo(() => {
    // Build schema *inside* component so t() is available for messages
    return z.object({
      title: z
        .string()
        .trim()
        .min(3, t("ads:validation.titleMin", { defaultValue: "Title must be at least 3 characters" }))
        .max(100, t("ads:validation.titleMax", { defaultValue: "Title must be less than 100 characters" })),
      description: z
        .string()
        .trim()
        .min(10, t("ads:validation.descriptionMin", { defaultValue: "Description must be at least 10 characters" }))
        .max(1000, t("ads:validation.descriptionMax", { defaultValue: "Description must be less than 1000 characters" })),
      category_id: z
        .string()
        .uuid(t("ads:validation.categoryRequired", { defaultValue: "Please select a category" })),
      location: z
        .string()
        .trim()
        .max(100, t("ads:validation.locationMax", { defaultValue: "Location must be less than 100 characters" }))
        .optional(),
      contact_phone: z
        .string()
        .trim()
        .max(20, t("ads:validation.phoneMax", { defaultValue: "Phone must be less than 20 characters" }))
        .optional(),
      contact_email: z
        .string()
        .trim()
        .email(t("ads:validation.emailInvalid", { defaultValue: "Invalid email address" }))
        .max(255, t("ads:validation.emailMax", { defaultValue: "Email must be less than 255 characters" }))
        .optional(),
website: z
  .string()
  .trim()
  .max(255, "Website must be less than 255 characters")
  .refine(
    (val) => {
      if (!val) return true; // empty ok

      // If it looks like a URL attempt (has dots or slashes), validate it
      if (val.includes(".") || val.includes("/")) {
        try {
          new URL(val.startsWith("http") ? val : `https://${val}`);
          return true;
        } catch {
          return false;
        }
      }

      // Otherwise allow any text (like "Coming soon")
      return true;
    },
    { message: "Please enter a valid URL or descriptive text" }
  )
  .optional()
  .or(z.literal("")),
    });
  }, [t]);

  const form = useForm<AdFormData>({
    resolver: zodResolver(adSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      category_id: "",
      location: "",
      contact_phone: "",
      contact_email: "",
      website: "",
    },
  });

  useEffect(() => {
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, description")
      .order("name");

    if (error) {
      toast({
        title: t("common:error", { defaultValue: "Error" }),
        description: t("ads:toast.loadCategoriesFail", { defaultValue: "Failed to load categories" }),
        variant: "destructive",
      });
      return;
    }

    setCategories((data as Category[]) || []);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("advertisements")
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: t("common:error", { defaultValue: "Error" }),
        description: t("ads:toast.uploadImageFail", { defaultValue: "Failed to upload image" }),
        variant: "destructive",
      });
      return null;
    }

    const { data } = supabase.storage.from("advertisements").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const onSubmit = async (data: AdFormData) => {
    if (!user) {
      toast({
        title: t("common:error", { defaultValue: "Error" }),
        description: t("ads:toast.mustBeLoggedIn", { defaultValue: "You must be logged in to submit an ad" }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = existingImageUrl ?? null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) {
          setIsSubmitting(false);
          return;
        }
      } else if (!keepExistingImage) {
        imageUrl = null;
      }

const websiteNormalized =
  data.website && data.website.trim()
    ? (data.website.startsWith("http")
        ? data.website.trim()
        : `https://${data.website.trim()}`)
    : null;

      const adData = {
        title: data.title,
        description: data.description,
        category_id: data.category_id,
        user_id: user.id,
        image_url: imageUrl,
        website: data.website ? normalizeWebsite(data.website) : null,
        location: data.location ? data.location.trim() : null,
        contact_phone: data.contact_phone ? data.contact_phone.trim() : null,
        contact_email: data.contact_email ? data.contact_email.trim() : null,
      };

      if (mode === "edit" && advertisementId) {
        const { error } = await supabase
          .from("advertisements")
          .update(adData)
          .eq("id", advertisementId);

        if (error) throw error;

        toast({
          title: t("common:success", { defaultValue: "Success" }),
          description: t("ads:toast.updated", { defaultValue: "Your advertisement has been updated" }),
        });
      } else {
        const { error } = await supabase.from("advertisements").insert(adData);
        if (error) throw error;

        toast({
          title: t("common:success", { defaultValue: "Success" }),
          description: t("ads:toast.submitted", { defaultValue: "Your advertisement has been submitted for review" }),
        });
      }

      form.reset();
      setImageFile(null);
      onSuccess?.();
    } catch {
      toast({
        title: t("common:error", { defaultValue: "Error" }),
        description: t("ads:toast.unexpected", { defaultValue: "An unexpected error occurred" }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("common:error", { defaultValue: "Error" }),
        description: t("ads:toast.imageTooLarge", { defaultValue: "Image must be less than 5MB" }),
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === "edit"
            ? t("ads:editTitle", { defaultValue: "Edit Your Advertisement" })
            : t("ads:submitTitle", { defaultValue: "Submit Your Business" })}
        </CardTitle>

        <CardDescription>
          {mode === "edit"
            ? t("ads:editSubtitle", { defaultValue: "Update your business listing details below." })
            : t("ads:submitSubtitle", { defaultValue: "Share your halal business or service with the community" })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("ads:form.businessName", { defaultValue: "Business Name" })} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("ads:form.businessNamePlaceholder", {
                        defaultValue: "Enter your business name",
                      })}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("ads:form.description", { defaultValue: "Description" })} *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("ads:form.descriptionPlaceholder", {
                        defaultValue: "Describe your business, services, or products...",
                      })}
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("ads:form.category", { defaultValue: "Category" })} *
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("ads:form.categoryPlaceholder", {
                            defaultValue: "Select a category",
                          })}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ads:form.location", { defaultValue: "Location" })}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("ads:form.locationPlaceholder", { defaultValue: "City, State" })}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ads:form.phoneNumber", { defaultValue: "Phone Number" })}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("ads:form.phoneNumberPlaceholder", { defaultValue: "(555) 123-4567" })}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:email", { defaultValue: "Email" })}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("ads:form.emailPlaceholder", { defaultValue: "business@example.com" })}
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ads:form.websiteOptional", { defaultValue: "Website (Optional)" })}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("ads:form.websitePlaceholder", {
                        defaultValue: "https://www.yourbusiness.com (or leave blank)",
                      })}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    {t("ads:form.websiteHelp", {
                      defaultValue: "Enter your website URL or leave blank if you don't have one yet",
                    })}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("ads:form.businessImage", { defaultValue: "Business Image" })}
              </label>

              {existingImageUrl && keepExistingImage && !imageFile && (
                <div className="space-y-2">
                  <img
                    src={existingImageUrl}
                    alt={t("ads:form.currentImageAlt", { defaultValue: "Current" })}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setKeepExistingImage(false)}
                  >
                    {t("ads:form.removeImage", { defaultValue: "Remove Image" })}
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex items-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  {existingImageUrl && keepExistingImage
                    ? t("ads:form.changeImage", { defaultValue: "Change Image" })
                    : t("ads:form.chooseImage", { defaultValue: "Choose Image" })}
                </label>

                {imageFile && <span className="text-sm text-muted-foreground">{imageFile.name}</span>}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "edit"
                  ? t("ads:buttons.updating", { defaultValue: "Updating..." })
                  : t("ads:buttons.submitting", { defaultValue: "Submitting..." })
                : mode === "edit"
                  ? t("ads:buttons.update", { defaultValue: "Update Advertisement" })
                  : t("ads:buttons.submit", { defaultValue: "Submit Advertisement" })}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};