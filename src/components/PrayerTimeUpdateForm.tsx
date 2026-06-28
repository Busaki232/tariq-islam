import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const prayerTimeSchema = z.object({
  mosqueName: z.string().min(1, "Mosque name is required"),
  contactName: z.string().min(1, "Your name is required"),
  contactEmail: z.string().email("Valid email is required"),
  fajr: z.string().min(1, "Fajr time is required"),
  dhuhr: z.string().min(1, "Dhuhr time is required"),
  asr: z.string().min(1, "Asr time is required"),
  maghrib: z.string().min(1, "Maghrib time is required"),
  isha: z.string().min(1, "Isha time is required"),
  jummah: z.string().optional(),
  notes: z.string().optional()
});

type PrayerTimeFormValues = z.infer<typeof prayerTimeSchema>;

interface PrayerTimeUpdateFormProps {
  onSuccess?: () => void;
}

// Pre-defined mosque list (same as in Mosques.tsx)
const mosqueOptions = [
  "Islamic Society of Greater Milwaukee - Milwaukee, WI",
  "Islamic Society of the Midwest - Plainfield, IL", 
  "Islamic Center of Minnesota - Fridley, MN",
  "Muslim Center of Detroit - Detroit, MI",
  "Masjid Al-Hikmah - Cleveland, OH",
  "Islamic Association of Chicago - Chicago, IL",
  "Other (please specify in notes)"
];

export default function PrayerTimeUpdateForm({ onSuccess }: PrayerTimeUpdateFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PrayerTimeFormValues>({
    resolver: zodResolver(prayerTimeSchema),
    defaultValues: {
      mosqueName: "",
      contactName: "",
      contactEmail: user?.email || "",
      fajr: "",
      dhuhr: "",
      asr: "",
      maghrib: "",
      isha: "",
      jummah: "",
      notes: ""
    }
  });

  const onSubmit = async (values: PrayerTimeFormValues) => {
    if (!user) {
      toast.error("You must be logged in to submit prayer time updates");
      return;
    }

    setIsSubmitting(true);

    try {
      const prayerTimes = {
        fajr: values.fajr,
        dhuhr: values.dhuhr,
        asr: values.asr,
        maghrib: values.maghrib,
        isha: values.isha,
        jummah: values.jummah || null
      };

      const { error } = await supabase
        .from("prayer_time_updates")
        .insert({
          user_id: user.id,
          mosque_name: values.mosqueName,
          contact_name: values.contactName,
          contact_email: values.contactEmail,
          prayer_times: prayerTimes,
          notes: values.notes || null
        });

      if (error) throw error;

      toast.success("Prayer time update submitted successfully!");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      logger.error('Error submitting prayer time update', error);
      toast.error("Failed to submit prayer time update. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mosqueName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Mosque</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a mosque" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mosqueOptions.map((mosque) => (
                      <SelectItem key={mosque} value={mosque}>
                        {mosque}
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
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="your.email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Prayer Times (Please provide correct times)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="fajr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fajr</FormLabel>
                  <FormControl>
                    <Input placeholder="5:30 AM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhuhr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dhuhr</FormLabel>
                  <FormControl>
                    <Input placeholder="12:30 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="asr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asr</FormLabel>
                  <FormControl>
                    <Input placeholder="3:45 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maghrib"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maghrib</FormLabel>
                  <FormControl>
                    <Input placeholder="6:15 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Isha</FormLabel>
                  <FormControl>
                    <Input placeholder="7:45 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jummah"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jummah (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="1:00 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional information about the prayer times or special considerations..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Submitting..." : "Submit Prayer Time Update"}
        </Button>
      </form>
    </Form>
  );
}