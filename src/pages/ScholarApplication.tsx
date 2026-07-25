import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ScholarApplicationRecord = {
  id: string;
  display_name: string;
  biography: string | null;
  specialties: string[];
  languages: string[];
  country: string | null;
  city: string | null;
  website_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  verification_status: string;
  verification_notes: string | null;
};

const splitCommaSeparatedValues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const ScholarApplication = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingApplication, setExistingApplication] =
    useState<ScholarApplicationRecord | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [biography, setBiography] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [languages, setLanguages] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadApplication = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("scholar_profiles")
          .select(
            "id,display_name,biography,specialties,languages,country,city,website_url,youtube_url,facebook_url,instagram_url,verification_status,verification_notes"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          const application =
            data as ScholarApplicationRecord;

          setExistingApplication(application);
          setDisplayName(application.display_name);
          setBiography(application.biography ?? "");
          setSpecialties(
            application.specialties.join(", ")
          );
          setLanguages(
            application.languages.join(", ")
          );
          setCountry(application.country ?? "");
          setCity(application.city ?? "");
          setWebsiteUrl(application.website_url ?? "");
          setYoutubeUrl(application.youtube_url ?? "");
          setFacebookUrl(application.facebook_url ?? "");
          setInstagramUrl(application.instagram_url ?? "");
        }
      } catch (error) {
        console.error(
          "Could not load scholar application:",
          error
        );

        setErrorMessage(
          "Your scholar application could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadApplication();
  }, [user?.id]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    if (!displayName.trim()) {
      setErrorMessage(
        "Please enter the scholar display name."
      );
      return;
    }

    if (!biography.trim()) {
      setErrorMessage(
        "Please provide a scholar biography."
      );
      return;
    }

    const parsedSpecialties =
      splitCommaSeparatedValues(specialties);

    const parsedLanguages =
      splitCommaSeparatedValues(languages);

    if (parsedSpecialties.length === 0) {
      setErrorMessage(
        "Please enter at least one specialty."
      );
      return;
    }

    if (parsedLanguages.length === 0) {
      setErrorMessage(
        "Please enter at least one language."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const applicationPayload = {
        user_id: user.id,
        display_name: displayName.trim(),
        biography: biography.trim(),
        specialties: parsedSpecialties,
        languages: parsedLanguages,
        country: country.trim() || null,
        city: city.trim() || null,
        website_url: websiteUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existingApplication) {
        const { data, error } = await supabase
          .from("scholar_profiles")
          .update(applicationPayload)
          .eq("id", existingApplication.id)
          .eq("user_id", user.id)
          .select(
            "id,display_name,biography,specialties,languages,country,city,website_url,youtube_url,facebook_url,instagram_url,verification_status,verification_notes"
          )
          .single();

        if (error) {
          throw error;
        }

        setExistingApplication(
          data as ScholarApplicationRecord
        );

        setMessage(
          "Your scholar application has been updated."
        );
      } else {
        const { data, error } = await supabase
          .from("scholar_profiles")
          .insert({
            ...applicationPayload,
            verification_status: "pending",
            is_featured: false,
            is_active: true,
          })
          .select(
            "id,display_name,biography,specialties,languages,country,city,website_url,youtube_url,facebook_url,instagram_url,verification_status,verification_notes"
          )
          .single();

        if (error) {
          throw error;
        }

        setExistingApplication(
          data as ScholarApplicationRecord
        );

        setMessage(
          "Your scholar application has been submitted for review."
        );
      }
    } catch (error) {
      console.error(
        "Could not save scholar application:",
        error
      );

      setErrorMessage(
        "Your scholar application could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <p className="text-muted-foreground">
          Loading scholar application...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-24 sm:p-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h1 className="text-2xl font-bold">
          Scholar Application
        </h1>

        <p className="mt-2 text-muted-foreground">
          Apply to become a verified scholar on Tariq Islam.
          Applications are reviewed before scholar features are
          enabled.
        </p>

        {existingApplication && (
          <div className="mt-5 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              Application status
            </p>

            <p className="mt-1 capitalize">
              {existingApplication.verification_status}
            </p>

            {existingApplication.verification_notes && (
              <p className="mt-2 text-sm text-muted-foreground">
                {existingApplication.verification_notes}
              </p>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5"
        >
          <div>
            <label
              htmlFor="scholar-display-name"
              className="text-sm font-medium"
            >
              Scholar display name
            </label>

            <input
              id="scholar-display-name"
              type="text"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="Example: Sheikh Abdullah"
              required
            />
          </div>

          <div>
            <label
              htmlFor="scholar-biography"
              className="text-sm font-medium"
            >
              Biography
            </label>

            <textarea
              id="scholar-biography"
              value={biography}
              onChange={(event) =>
                setBiography(event.target.value)
              }
              className="mt-2 min-h-[150px] w-full rounded-md border bg-background p-3"
              placeholder="Education, experience, teaching background, and community work"
              required
            />
          </div>

          <div>
            <label
              htmlFor="scholar-specialties"
              className="text-sm font-medium"
            >
              Specialties
            </label>

            <input
              id="scholar-specialties"
              type="text"
              value={specialties}
              onChange={(event) =>
                setSpecialties(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="Quran, Hadith, Fiqh"
              required
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Separate each specialty with a comma.
            </p>
          </div>

          <div>
            <label
              htmlFor="scholar-languages"
              className="text-sm font-medium"
            >
              Languages
            </label>

            <input
              id="scholar-languages"
              type="text"
              value={languages}
              onChange={(event) =>
                setLanguages(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="English, Arabic, Hausa"
              required
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Separate each language with a comma.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="scholar-country"
                className="text-sm font-medium"
              >
                Country
              </label>

              <input
                id="scholar-country"
                type="text"
                value={country}
                onChange={(event) =>
                  setCountry(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              />
            </div>

            <div>
              <label
                htmlFor="scholar-city"
                className="text-sm font-medium"
              >
                City
              </label>

              <input
                id="scholar-city"
                type="text"
                value={city}
                onChange={(event) =>
                  setCity(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="scholar-website"
              className="text-sm font-medium"
            >
              Website
            </label>

            <input
              id="scholar-website"
              type="url"
              value={websiteUrl}
              onChange={(event) =>
                setWebsiteUrl(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="https://"
            />
          </div>

          <div>
            <label
              htmlFor="scholar-youtube"
              className="text-sm font-medium"
            >
              YouTube
            </label>

            <input
              id="scholar-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(event) =>
                setYoutubeUrl(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="https://youtube.com/"
            />
          </div>

          <div>
            <label
              htmlFor="scholar-facebook"
              className="text-sm font-medium"
            >
              Facebook
            </label>

            <input
              id="scholar-facebook"
              type="url"
              value={facebookUrl}
              onChange={(event) =>
                setFacebookUrl(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="https://facebook.com/"
            />
          </div>

          <div>
            <label
              htmlFor="scholar-instagram"
              className="text-sm font-medium"
            >
              Instagram
            </label>

            <input
              id="scholar-instagram"
              type="url"
              value={instagramUrl}
              onChange={(event) =>
                setInstagramUrl(event.target.value)
              }
              className="mt-2 h-11 w-full rounded-md border bg-background px-3"
              placeholder="https://instagram.com/"
            />
          </div>

          {message && (
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              {message}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full"
          >
            {saving
              ? "Saving application..."
              : existingApplication
                ? "Update Application"
                : "Submit Application"}
          </Button>
        </form>
      </section>
    </main>
  );
};

export default ScholarApplication;