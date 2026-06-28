import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HeroButton } from "@/components/ui/hero-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useTranslation } from "react-i18next";

type FormValues = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  location: string;
  experience: string;
  motivation: string;
  availability: string;
};

export const LeadershipApplicationForm = () => {
  const { t } = useTranslation("dashboard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const formSchema = useMemo(() => {
    return z.object({
      fullName: z
        .string()
        .min(
          2,
          t("leadershipForm.validation.fullNameMin", {
            defaultValue: "Full name must be at least 2 characters",
          })
        ),
      email: z
        .string()
        .email(
          t("leadershipForm.validation.invalidEmail", {
            defaultValue: "Invalid email address",
          })
        ),
      phoneNumber: z.string().optional(),
      location: z
        .string()
        .min(
          2,
          t("leadershipForm.validation.locationRequired", {
            defaultValue: "Location is required",
          })
        ),
      experience: z
        .string()
        .min(
          10,
          t("leadershipForm.validation.experienceMin", {
            defaultValue:
              "Please describe your experience (minimum 10 characters)",
          })
        ),
      motivation: z
        .string()
        .min(
          10,
          t("leadershipForm.validation.motivationMin", {
            defaultValue: "Please share your motivation (minimum 10 characters)",
          })
        ),
      availability: z
        .string()
        .min(
          5,
          t("leadershipForm.validation.availabilityMin", {
            defaultValue: "Please describe your availability",
          })
        ),
    });
  }, [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      location: "",
      experience: "",
      motivation: "",
      availability: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast({
        title: t("leadershipForm.toasts.authRequiredTitle", {
          defaultValue: "Authentication Required",
        }),
        description: t("leadershipForm.toasts.authRequiredDesc", {
          defaultValue: "Please sign in to submit your application.",
        }),
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("leadership_applications").insert({
        user_id: user.id,
        full_name: values.fullName,
        email: values.email,
        phone_number: values.phoneNumber || null,
        location: values.location,
        experience: values.experience,
        motivation: values.motivation,
        availability: values.availability,
      });

      if (error) throw error;

      toast({
        title: t("leadershipForm.toasts.submittedTitle", {
          defaultValue: "Application Submitted!",
        }),
        description: t("leadershipForm.successDesc", {
          defaultValue:
            "Thank you for your interest in becoming a community leader. We'll review your application and get back to you soon.",
        }),
      });

      navigate("/");
    } catch (error) {
      logger.error("Error submitting leadership application", error);
      toast({
        title: t("leadershipForm.toasts.submissionFailedTitle", {
          defaultValue: "Submission Failed",
        }),
        description: t("leadershipForm.toasts.submissionFailedDesc", {
          defaultValue:
            "There was an error submitting your application. Please try again.",
        }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>
          {t("leadershipForm.title", { defaultValue: "Leadership Application" })}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.fullName", {
                      defaultValue: "Full Name *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("leadershipForm.placeholders.fullName", {
                        defaultValue: "Enter your full name",
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.email", {
                      defaultValue: "Email Address *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("leadershipForm.placeholders.email", {
                        defaultValue: "Enter your email",
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
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.phoneNumber", {
                      defaultValue: "Phone Number",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={t("leadershipForm.placeholders.phoneNumber", {
                        defaultValue: "Enter your phone number",
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
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.location", {
                      defaultValue: "Location/City *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("leadershipForm.placeholders.location", {
                        defaultValue: "Enter your city and state",
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
              name="experience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.experience", {
                      defaultValue: "Relevant Experience *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("leadershipForm.placeholders.experience", {
                        defaultValue:
                          "Describe your experience in community leadership, Islamic organizations, or volunteer work...",
                      })}
                      className="h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="motivation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.motivation", {
                      defaultValue: "Motivation *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("leadershipForm.placeholders.motivation", {
                        defaultValue:
                          "Why do you want to become a community leader? What drives your passion for building the global Muslim community?",
                      })}
                      className="h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("leadershipForm.labels.availability", {
                      defaultValue: "Availability *",
                    })}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t(
                        "leadershipForm.placeholders.availability",
                        {
                          defaultValue:
                            "Describe your availability and how much time you can dedicate to community leadership activities...",
                        }
                      )}
                      className="h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <HeroButton
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="flex-1"
              >
                {t("leadershipForm.buttons.cancel", { defaultValue: "Cancel" })}
              </HeroButton>

              <HeroButton
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting
                  ? t("leadershipForm.buttons.submitting", {
                      defaultValue: "Submitting...",
                    })
                  : t("leadershipForm.buttons.submit", {
                      defaultValue: "Submit Application",
                    })}
              </HeroButton>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};