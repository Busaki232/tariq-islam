import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { SecurityUtils, secureValidation } from "@/lib/security";
import { Loader2 } from "lucide-react";

const feedbackSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  subject: z.string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(200, "Subject must be less than 200 characters"),
  message: z.string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters"),
  feedbackType: z.enum(["general", "bug_report", "feature_request", "help_support", "other"])
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  onSuccess?: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      feedbackType: "general"
    }
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    try {
      setIsSubmitting(true);

      // Security validation
      if (!secureValidation.email(values.email)) {
        toast({
          title: "Invalid Email",
          description: "Please provide a valid email address.",
          variant: "destructive"
        });
        return;
      }

      if (SecurityUtils.containsSuspiciousPatterns(values.message) ||
          SecurityUtils.containsSuspiciousPatterns(values.subject)) {
        toast({
          title: "Suspicious Content Detected",
          description: "Your feedback contains potentially unsafe content. Please remove any scripts or special characters.",
          variant: "destructive"
        });
        return;
      }

      // Rate limiting check
      const rateLimitKey = `feedback_${user?.id || values.email}`;
      if (SecurityUtils.checkRateLimit(rateLimitKey, 3, 3600000)) { // 3 submissions per hour
        toast({
          title: "Too Many Submissions",
          description: "You can only submit feedback 3 times per hour. Please try again later.",
          variant: "destructive"
        });
        return;
      }

      // Sanitize inputs
      const sanitizedData = {
        name: SecurityUtils.sanitizeText(values.name),
        email: SecurityUtils.sanitizeText(values.email),
        subject: SecurityUtils.sanitizeText(values.subject),
        message: SecurityUtils.sanitizeText(values.message),
        feedback_type: values.feedbackType,
        user_id: user?.id || null
      };

      const { error } = await supabase
        .from("user_feedback")
        .insert(sanitizedData);

      if (error) throw error;

      SecurityUtils.clearRateLimit(rateLimitKey);
      SecurityUtils.logSecurityEvent("feedback_submitted", {
        feedbackType: values.feedbackType,
        userId: user?.id || "anonymous"
      });

      toast({
        title: "✅ Feedback Submitted",
        description: "Thank you for your feedback! We'll review it and get back to you if needed."
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
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
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="your.email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="feedbackType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feedback Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select feedback type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="general">General Feedback</SelectItem>
                  <SelectItem value="bug_report">Bug Report</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="help_support">Help/Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject *</FormLabel>
              <FormControl>
                <Input placeholder="Brief summary of your feedback" {...field} />
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
              <FormLabel>Message *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please provide detailed feedback..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
