import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Building,
  Clock,
  Phone,
  Globe,
  Mail,
  MapPin,
  User,
  Languages,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useTranslation } from "react-i18next";

type MosqueSubmissionFormData = {
  mosque_name: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  imam_name?: string;
  description?: string;

  fajr?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  jummah?: string;
};

const MosqueSubmissionForm = () => {
  const { t } = useTranslation("mosques");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();

  const mosqueSubmissionSchema = useMemo(() => {
    return z.object({
      mosque_name: z
        .string()
        .trim()
        .nonempty(
          t("form.validation.mosqueNameRequired", {
            defaultValue: "Mosque name is required",
          })
        )
        .max(
          100,
          t("form.validation.mosqueNameMax", {
            defaultValue: "Mosque name must be 100 characters or less",
          })
        ),
      address: z
        .string()
        .trim()
        .nonempty(
          t("form.validation.addressRequired", {
            defaultValue: "Address is required",
          })
        )
        .max(
          200,
          t("form.validation.addressMax", {
            defaultValue: "Address must be 200 characters or less",
          })
        ),
      city: z
        .string()
        .trim()
        .nonempty(
          t("form.validation.cityRequired", {
            defaultValue: "City is required",
          })
        )
        .max(
          50,
          t("form.validation.cityMax", {
            defaultValue: "City must be 50 characters or less",
          })
        ),
      state: z
        .string()
        .trim()
        .nonempty(
          t("form.validation.stateRequired", {
            defaultValue: "State is required",
          })
        )
        .max(
          20,
          t("form.validation.stateMax", {
            defaultValue: "State must be 20 characters or less",
          })
        ),

      zip_code: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z
        .string()
        .trim()
        .email(
          t("form.validation.invalidEmail", {
            defaultValue: "Invalid email format",
          })
        )
        .optional()
        .or(z.literal("")),
      website: z.string().trim().optional(),
      imam_name: z.string().trim().optional(),
      description: z
        .string()
        .trim()
        .max(
          1000,
          t("form.validation.descriptionMax", {
            defaultValue: "Description must be less than 1000 characters",
          })
        )
        .optional(),

      fajr: z.string().trim().optional(),
      dhuhr: z.string().trim().optional(),
      asr: z.string().trim().optional(),
      maghrib: z.string().trim().optional(),
      isha: z.string().trim().optional(),
      jummah: z.string().trim().optional(),
    });
  }, [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MosqueSubmissionFormData>({
    resolver: zodResolver(mosqueSubmissionSchema),
  });

  const languageOptions = useMemo(
    () => [
      t("form.languages.english", { defaultValue: "English" }),
      t("form.languages.arabic", { defaultValue: "Arabic" }),
      t("form.languages.urdu", { defaultValue: "Urdu" }),
      t("form.languages.french", { defaultValue: "French" }),
      t("form.languages.turkish", { defaultValue: "Turkish" }),
      t("form.languages.malay", { defaultValue: "Malay" }),
      t("form.languages.indonesian", { defaultValue: "Indonesian" }),
      t("form.languages.bengali", { defaultValue: "Bengali" }),
      t("form.languages.persian", { defaultValue: "Persian" }),
      t("form.languages.hausa", { defaultValue: "Hausa" }),
      t("form.languages.yoruba", { defaultValue: "Yoruba" }),
      t("form.languages.swahili", { defaultValue: "Swahili" }),
      t("form.languages.somali", { defaultValue: "Somali" }),
      t("form.languages.pashto", { defaultValue: "Pashto" }),
      t("form.languages.kurdish", { defaultValue: "Kurdish" }),
    ],
    [t]
  );

  const serviceOptions = useMemo(
    () => [
      t("form.services.dailyPrayers", { defaultValue: "Daily Prayers" }),
      t("form.services.jummahPrayers", { defaultValue: "Jummah Prayers" }),
      t("form.services.islamicEducation", { defaultValue: "Islamic Education" }),
      t("form.services.youthPrograms", { defaultValue: "Youth Programs" }),
      t("form.services.womensPrograms", { defaultValue: "Women's Programs" }),
      t("form.services.communityOutreach", {
        defaultValue: "Community Outreach",
      }),
      t("form.services.communityEvents", { defaultValue: "Community Events" }),
      t("form.services.islamicSchool", { defaultValue: "Islamic School" }),
      t("form.services.marriageServices", { defaultValue: "Marriage Services" }),
      t("form.services.funeralServices", { defaultValue: "Funeral Services" }),
      t("form.services.counseling", { defaultValue: "Counseling" }),
      t("form.services.foodBank", { defaultValue: "Food Bank" }),
      t("form.services.interfaithDialogue", {
        defaultValue: "Interfaith Dialogue",
      }),
    ],
    [t]
  );

  const handleLanguageChange = (language: string, checked: boolean) => {
    if (checked) setSelectedLanguages((prev) => [...prev, language]);
    else setSelectedLanguages((prev) => prev.filter((l) => l !== language));
  };

  const handleServiceChange = (service: string, checked: boolean) => {
    if (checked) setSelectedServices((prev) => [...prev, service]);
    else setSelectedServices((prev) => prev.filter((s) => s !== service));
  };

  const onSubmit = async (data: MosqueSubmissionFormData) => {
    if (!user) {
      toast({
        title: t("auth.signInRequiredTitle", {
          defaultValue: "Sign in Required",
        }),
        description: t("auth.submitMosqueBody", {
          defaultValue: "Please sign in to submit a mosque.",
        }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const prayerTimes = {
        fajr: data.fajr || null,
        dhuhr: data.dhuhr || null,
        asr: data.asr || null,
        maghrib: data.maghrib || null,
        isha: data.isha || null,
        jummah: data.jummah || null,
      };

      const { error } = await supabase.from("mosque_submissions").insert({
        user_id: user.id,
        mosque_name: data.mosque_name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        imam_name: data.imam_name || null,
        description: data.description || null,
        languages: selectedLanguages,
        services: selectedServices,
        prayer_times: prayerTimes,
      });

      if (error) throw error;

      toast({
        title: t("form.toasts.successTitle", {
          defaultValue: "Submission Successful!",
        }),
        description: t("form.toasts.successDesc", {
          defaultValue:
            "Your mosque submission has been received and is under review.",
        }),
        variant: "default",
      });

      reset();
      setSelectedLanguages([]);
      setSelectedServices([]);
    } catch (error: any) {
      logger.error("Error submitting mosque", error);
      toast({
        title: t("form.toasts.failedTitle", { defaultValue: "Submission Failed" }),
        description:
          error?.message ||
          t("form.toasts.failedDesc", {
            defaultValue: "An error occurred while submitting your mosque.",
          }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-islamic-green/10 rounded-full flex items-center justify-center mb-4">
          <Building className="w-6 h-6 text-islamic-green" />
        </div>

        <CardTitle className="text-2xl text-foreground">
          {t("submitPageTitle", { defaultValue: "Submit a Mosque" })}
        </CardTitle>

        <p className="text-muted-foreground">
          {t("submitPageSubtitle", {
            defaultValue:
              "Help us build a comprehensive directory of Islamic centers across the Midwest",
          })}
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("form.sections.basicInfo", { defaultValue: "Basic Information" })}
            </h3>

            <div>
              <Label htmlFor="mosque_name">
                {t("form.labels.mosqueName", {
                  defaultValue: "Mosque/Islamic Center Name *",
                })}
              </Label>
              <Input
                id="mosque_name"
                {...register("mosque_name")}
                placeholder={t("form.placeholders.mosqueName", {
                  defaultValue: "e.g., Islamic Center of Chicago",
                })}
                className={errors.mosque_name ? "border-destructive" : ""}
              />
              {errors.mosque_name && (
                <p className="text-sm text-destructive mt-1">
                  {String(errors.mosque_name.message || "")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address">
                  {t("form.labels.streetAddress", {
                    defaultValue: "Street Address *",
                  })}
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="address"
                    {...register("address")}
                    placeholder={t("form.placeholders.streetAddress", {
                      defaultValue: "123 Main Street",
                    })}
                    className={`pl-10 ${errors.address ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.address && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors.address.message || "")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="city">
                  {t("form.labels.city", { defaultValue: "City *" })}
                </Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder={t("form.placeholders.city", { defaultValue: "Chicago" })}
                  className={errors.city ? "border-destructive" : ""}
                />
                {errors.city && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors.city.message || "")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="state">
                  {t("form.labels.state", { defaultValue: "State *" })}
                </Label>
                <Input
                  id="state"
                  {...register("state")}
                  placeholder={t("form.placeholders.state", { defaultValue: "IL" })}
                  className={errors.state ? "border-destructive" : ""}
                />
                {errors.state && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors.state.message || "")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="zip_code">
                  {t("form.labels.zip", { defaultValue: "ZIP Code" })}
                </Label>
                <Input
                  id="zip_code"
                  {...register("zip_code")}
                  placeholder={t("form.placeholders.zip", { defaultValue: "60610" })}
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("form.sections.contactInfo", { defaultValue: "Contact Information" })}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">
                  {t("form.labels.phone", { defaultValue: "Phone Number" })}
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    {...register("phone")}
                    placeholder={t("form.placeholders.phone", {
                      defaultValue: "(312) 555-0100",
                    })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">
                  {t("form.labels.email", { defaultValue: "Email" })}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    {...register("email")}
                    placeholder={t("form.placeholders.email", {
                      defaultValue: "info@masjid.org",
                    })}
                    type="email"
                    className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors.email.message || "")}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="website">
                {t("form.labels.website", { defaultValue: "Website" })}
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="website"
                  {...register("website")}
                  placeholder={t("form.placeholders.website", {
                    defaultValue: "www.masjid.org",
                  })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Religious Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("form.sections.religiousInfo", {
                defaultValue: "Religious Information",
              })}
            </h3>

            <div>
              <Label htmlFor="imam_name">
                {t("form.labels.imam", { defaultValue: "Imam/Religious Leader" })}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="imam_name"
                  {...register("imam_name")}
                  placeholder={t("form.placeholders.imam", {
                    defaultValue: "Sheikh Abdullah Hassan",
                  })}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Languages className="w-4 h-4" />
                {t("form.labels.languagesSpoken", { defaultValue: "Languages Spoken" })}
              </Label>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {languageOptions.map((language) => (
                  <div key={language} className="flex items-center space-x-2">
                    <Checkbox
                      id={`language-${language}`}
                      checked={selectedLanguages.includes(language)}
                      onCheckedChange={(checked) =>
                        handleLanguageChange(language, checked as boolean)
                      }
                    />
                    <Label htmlFor={`language-${language}`} className="text-sm">
                      {language}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>
                {t("form.labels.servicesOffered", { defaultValue: "Services Offered" })}
              </Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {serviceOptions.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service}`}
                      checked={selectedServices.includes(service)}
                      onCheckedChange={(checked) =>
                        handleServiceChange(service, checked as boolean)
                      }
                    />
                    <Label htmlFor={`service-${service}`} className="text-sm">
                      {service}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Prayer Times */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("prayerTimes.title", { defaultValue: "Prayer Times Today" })}
            </h3>

            <p className="text-sm text-muted-foreground">
              {t("form.prayerTimesHint", {
                defaultValue:
                  "Please provide prayer times in 12-hour format (e.g., 5:30 AM)",
              })}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fajr">{t("prayerTimes.fajr", { defaultValue: "Fajr" })}</Label>
                <Input id="fajr" {...register("fajr")} placeholder="5:30 AM" />
              </div>

              <div>
                <Label htmlFor="dhuhr">
                  {t("prayerTimes.dhuhr", { defaultValue: "Dhuhr" })}
                </Label>
                <Input id="dhuhr" {...register("dhuhr")} placeholder="12:45 PM" />
              </div>

              <div>
                <Label htmlFor="asr">{t("prayerTimes.asr", { defaultValue: "Asr" })}</Label>
                <Input id="asr" {...register("asr")} placeholder="3:30 PM" />
              </div>

              <div>
                <Label htmlFor="maghrib">
                  {t("prayerTimes.maghrib", { defaultValue: "Maghrib" })}
                </Label>
                <Input id="maghrib" {...register("maghrib")} placeholder="6:15 PM" />
              </div>

              <div>
                <Label htmlFor="isha">{t("prayerTimes.isha", { defaultValue: "Isha" })}</Label>
                <Input id="isha" {...register("isha")} placeholder="8:00 PM" />
              </div>

              <div>
                <Label htmlFor="jummah">
                  {t("prayerTimes.jummah", { defaultValue: "Jummah" })}
                </Label>
                <Input id="jummah" {...register("jummah")} placeholder="1:00 PM" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              {t("form.labels.description", { defaultValue: "Description" })}
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder={t("form.placeholders.description", {
                defaultValue:
                  "Tell us about your mosque, community programs, special features...",
              })}
              rows={4}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">
                {String(errors.description.message || "")}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting
              ? t("cta.submitting", { defaultValue: "Submitting..." })
              : t("cta.submitMosque", { defaultValue: "Submit Mosque" })}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MosqueSubmissionForm;