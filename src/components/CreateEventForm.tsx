import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
 import { useTranslation } from "react-i18next";

const eventSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title must be less than 100 characters"),
  description: z.string().min(20, "Description must be at least 20 characters").max(1000, "Description must be less than 1000 characters"),
  event_date: z.string().min(1, "Event date is required"),
  event_time: z.string().min(1, "Event time is required"),
  location: z.string().min(5, "Location must be at least 5 characters").max(200, "Location must be less than 200 characters"),
  category: z.enum(["religious", "educational", "cultural", "social", "general"]),
  max_attendees: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
});

type EventFormData = z.infer<typeof eventSchema>;

interface CreateEventFormProps {
  onEventCreated: () => void;
}

export const CreateEventForm = ({ onEventCreated }: CreateEventFormProps) => {
   const { t } = useTranslation(["events", "common"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      event_date: "",
      event_time: "",
      location: "",
      category: "general",
      max_attendees: "",
      image_url: "",
    },
  });

  const onSubmit = async (data: EventFormData) => {
    if (!user) {
      toast.error("You must be logged in to create an event");
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate that the event date is in the future
      const eventDateTime = new Date(`${data.event_date}T${data.event_time}`);
      if (eventDateTime <= new Date()) {
        toast.error("Event date and time must be in the future");
        setIsSubmitting(false);
        return;
      }

      const eventData = {
        title: data.title.trim(),
        description: data.description.trim(),
        event_date: data.event_date,
        event_time: data.event_time,
        location: data.location.trim(),
        category: data.category,
        organizer_id: user.id,
        creator_id: user.id,
        start_at: `${data.event_date}T${data.event_time}:00`,
        max_attendees: data.max_attendees ? parseInt(data.max_attendees) : null,
        image_url: data.image_url || null,
      };

      const { error } = await supabase
        .from('events')
        .insert([eventData]);

      if (error) {
        logger.error('Error creating event', error);
        toast.error("Failed to create event. Please try again.");
      } else {
        toast.success("Event created successfully!");
        form.reset();
        onEventCreated();
      }
    } catch (error) {
      logger.error('Error creating event', error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for min date validation
  const today = new Date().toISOString().split('T')[0];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title *</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t("events:form.titlePlaceholder", { defaultValue: "Enter event title..." })}
                  {...field} 
                  disabled={isSubmitting}
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
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t("events:form.descriptionPlaceholder", { defaultValue: "Describe your event..." })}
                  className="min-h-[100px]" 
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="event_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Date *</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    min={today}
                    {...field} 
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="event_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Time *</FormLabel>
                <FormControl>
                  <Input 
                    type="time" 
                    {...field} 
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location *</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t("events:form.locationPlaceholder", { defaultValue: "Enter event location..." })}
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("events:form.categoryPlaceholder", { defaultValue: "Select category" })} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="religious">Religious</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="cultural">Cultural</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_attendees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Attendees (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1"
                   placeholder={t("events:form.capacityPlaceholder", { defaultValue: "No limit" })}
                    {...field} 
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl>
                <Input 
                  type="url"
                  placeholder={t("events:form.imagePlaceholder", { defaultValue: "https://example.com/image.jpg" })}
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting
              ? t("events:creating", { defaultValue: "Creating Event..." })
              : t("events:create", { defaultValue: "Create Event" })}
          </Button>
        </div>
      </form>
    </Form>
  );
};