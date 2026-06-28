// src/components/ContactRequestForm.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SecurityUtils } from "@/lib/security";

import { Shield, AlertTriangle, MessageSquare } from "lucide-react";

type Mode = "business" | "site";

export interface ContactRequestFormProps {
  mode?: Mode;

  // Business mode only
  advertisementId?: string;
  businessName?: string;

  onSuccess?: () => void;
  onCancel?: () => void;
  onMessagingRequested?: (contactRequestId: string) => void;
}

interface UserReputation {
  reputation_score: number;
  total_requests: number;
  approved_requests: number;
  rejected_requests: number;
}

type ContactRequestData = {
  name: string;
  email: string;
  subject?: string;
  reason: string;
  message: string;
};

export function ContactRequestForm({
  mode = "site",
  advertisementId,
  businessName,
  onSuccess,
  onCancel,
  onMessagingRequested,
}: ContactRequestFormProps) {
  const { t } = useTranslation("contact");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userReputation, setUserReputation] = useState<UserReputation | null>(null);
  const [riskScore, setRiskScore] = useState<number>(0);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  // Schema with translated messages
  const contactRequestSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(100, t("validation.nameTooLong", { defaultValue: "Name must be less than 100 characters" })),
        email: z
          .string()
          .trim()
          .min(1, t("validation.emailRequired"))
          .email(t("validation.emailInvalid"))
          .max(255, t("validation.emailTooLong", { defaultValue: "Email must be less than 255 characters" })),
        subject: z
          .string()
          .trim()
          .min(3, t("validation.subjectRequired", { defaultValue: "Subject is required" }))
          .max(120, t("validation.subjectTooLong", { defaultValue: "Subject must be less than 120 characters" }))
          .optional()
          .or(z.literal("")),
        reason: z
          .string()
          .trim()
          .min(5, t("validation.reasonRequired", { defaultValue: "Please provide a reason for contact" }))
          .max(500, t("validation.reasonTooLong", { defaultValue: "Reason must be less than 500 characters" })),
        message: z
          .string()
          .trim()
          .min(10, t("validation.messageRequired"))
          .max(1000, t("validation.messageTooLong", { defaultValue: "Message must be less than 1000 characters" })),
      }),
    [t]
  );

  const effectiveTitle = useMemo(() => {
    if (mode === "business") {
      return t("business.title", { businessName: businessName || t("business.fallbackName", { defaultValue: "Business" }) });
    }
    return t("title");
  }, [mode, businessName, t]);

  const effectiveSubtitle = useMemo(() => {
    if (mode === "business") return t("business.subtitle");
    return t("subtitle");
  }, [mode, t]);

  const form = useForm<ContactRequestData>({
    resolver: zodResolver(contactRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      reason: "",
      message: "",
    },
  });

  useEffect(() => {
    if (!user) return;

    void fetchUserReputation();

    if (mode === "business" && advertisementId) {
      void calculateRiskScore();
    } else {
      setRiskScore(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, advertisementId]);

  const fetchUserReputation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("user_reputation").select("*").eq("user_id", user.id).single();

      // Not found is okay
      // @ts-expect-error supabase error code typing
      if (error && error.code !== "PGRST116") return;

      setUserReputation(
        data || {
          reputation_score: 50,
          total_requests: 0,
          approved_requests: 0,
          rejected_requests: 0,
        }
      );
    } catch {
      // silent
    }
  };

  const calculateRiskScore = async () => {
    if (!user || !advertisementId) return;

    try {
      const { data, error } = await supabase.rpc("calculate_risk_score", {
        _user_id: user.id,
        _advertisement_id: advertisementId,
      });

      if (error) throw error;
      setRiskScore(data || 0);
    } catch {
      // silent
    }
  };

  const getReputationBadgeVariant = (score: number) => {
    if (score >= 70) return "default";
    if (score >= 40) return "secondary";
    return "destructive";
  };

  const getRiskBadgeVariant = (score: number) => {
    if (score < 30) return "default";
    if (score < 60) return "secondary";
    return "destructive";
  };

  const riskLabel = (score: number) => {
    if (score < 30) return t("badges.riskLow", { defaultValue: "Low" });
    if (score < 60) return t("badges.riskMedium", { defaultValue: "Medium" });
    return t("badges.riskHigh", { defaultValue: "High" });
  };

  const openMessaging = () => {
    if (pendingRequestId && onMessagingRequested) {
      onMessagingRequested(pendingRequestId);
    }
  };

  const onSubmit = async (data: ContactRequestData) => {
    if (!user) {
      toast({
        title: t("toast.authRequiredTitle", { defaultValue: "Authentication Required" }),
        description: t("toast.authRequiredBody", { defaultValue: "Please sign in to send a message." }),
        variant: "destructive",
      });
      return;
    }

    if (mode === "business" && !advertisementId) {
      toast({
        title: t("toast.missingContextTitle", { defaultValue: "Missing business context" }),
        description: t("toast.missingContextBody", { defaultValue: "This form needs an advertisementId in business mode." }),
        variant: "destructive",
      });
      return;
    }

    const sanitized = {
      name: SecurityUtils.sanitizeText(data.name),
      email: SecurityUtils.sanitizeText(data.email),
      subject: SecurityUtils.sanitizeText(data.subject || ""),
      reason: SecurityUtils.sanitizeText(data.reason),
      message: SecurityUtils.sanitizeText(data.message),
    };

    const suspiciousInputs = [sanitized.name, sanitized.email, sanitized.subject, sanitized.reason, sanitized.message];
    if (suspiciousInputs.some((v) => SecurityUtils.containsSuspiciousPatterns(v))) {
      toast({
        title: t("toast.invalidInputTitle", { defaultValue: "Invalid Input" }),
        description: t("toast.invalidInputBody", { defaultValue: "Please remove any suspicious content and try again." }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "business") {
        const { data: result, error } = await supabase.rpc("submit_contact_request_secure", {
          _advertisement_id: advertisementId!,
          _requester_name: sanitized.name,
          _requester_email: sanitized.email,
          _message: `${sanitized.reason}\n\nMessage: ${sanitized.message}`,
        });

        if (error) throw error;

        const requestId = (result as any)?.id;
        if (requestId) setPendingRequestId(requestId);

        SecurityUtils.logSecurityEvent("contact_request_submitted", {
          advertisementId,
          riskScore,
          requiresVerification: riskScore > 50,
        });

        toast({
          title: t("toast.businessSuccessTitle", { defaultValue: "Request Sent Successfully" }),
          description: t("toast.businessSuccessBody", {
            defaultValue:
              "Your contact request has been sent securely. The business owner will review it and may contact you through our secure messaging system.",
          }),
        });

        form.reset();
        onSuccess?.();
        return;
      }

      const { error: insertErr } = await supabase.from("contact_messages").insert({
        user_id: user.id,
        name: sanitized.name,
        email: sanitized.email,
        subject: sanitized.subject || sanitized.reason,
        message: `${sanitized.reason}\n\nMessage: ${sanitized.message}`,
        created_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      SecurityUtils.logSecurityEvent("site_contact_submitted", { riskScore: 0 });

      toast({
        title: t("toast.successTitle"),
        description: t("toast.successBody"),
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();

      if (msg.includes("rate limit")) {
        toast({
          title: t("toast.rateLimitTitle", { defaultValue: "Rate Limit Exceeded" }),
          description: t("toast.rateLimitBody", { defaultValue: "You've sent too many messages recently. Please wait and try again." }),
          variant: "destructive",
        });
      } else if (msg.includes("contact_messages")) {
        toast({
          title: t("toast.storageMissingTitle", { defaultValue: "Contact storage not configured" }),
          description: t("toast.storageMissingBody", {
            defaultValue:
              "Your /contact page needs a table to store messages. Create a table (example: \"contact_messages\") or wire it to your existing table.",
          }),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.errorTitle"),
          description: t("toast.errorBody"),
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{effectiveTitle}</CardTitle>
        <CardDescription>{effectiveSubtitle}</CardDescription>

        {userReputation && mode === "business" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={getReputationBadgeVariant(userReputation.reputation_score)}>
              <Shield className="mr-1 h-3 w-3" />
              {t("badges.reputation", { defaultValue: "Reputation" })}: {userReputation.reputation_score}/100
            </Badge>

            {riskScore > 0 && (
              <Badge variant={getRiskBadgeVariant(riskScore)}>
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t("badges.risk", { defaultValue: "Risk" })}: {riskLabel(riskScore)}
              </Badge>
            )}
          </div>
        )}

        {mode === "business" && riskScore > 60 && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("business.highRiskNote", {
                defaultValue: "Your request may require additional verification due to security policies.",
              })}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("form.nameLabel")} <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("form.namePlaceholder")} {...field} />
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
                    {t("form.emailLabel")} <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("form.emailPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.subjectLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("form.subjectPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("form.typeLabel")} <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("form.typePlaceholder")}
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("form.messageLabel")} <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("form.messagePlaceholder")}
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>{t("form.securityNote", { defaultValue: "Messages are handled securely to protect privacy." })}</AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting
                  ? t("form.submitting")
                  : mode === "business"
                    ? t("business.sendButton", { defaultValue: "Send Secure Request" })
                    : t("form.submit")}
              </Button>

              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  {t("form.cancel", { defaultValue: "Cancel" })}
                </Button>
              )}
            </div>

            {mode === "business" && pendingRequestId && onMessagingRequested && (
              <Button type="button" variant="outline" onClick={openMessaging} className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                {t("business.openMessaging", { defaultValue: "Open Secure Messaging" })}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default ContactRequestForm;