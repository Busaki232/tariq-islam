import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Globe2,
  Languages,
  MapPin,
  Play,
  Radio,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ScholarProfile = {
  id: string;
  user_id: string;
  display_name: string;
  biography: string | null;
  specialties: string[];
  languages: string[];
  country: string | null;
  city: string | null;
  is_featured: boolean;
  is_active: boolean;
  verification_status: string;
};

type UserProfile = {
  user_id: string;
  avatar_url: string | null;
  username: string | null;
  full_name: string | null;
};

type ScholarWithProfile = ScholarProfile & {
  avatar_url: string | null;
  username: string | null;
  full_name: string | null;
};

type LiveScholarLivestream = {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  started_at: string | null;
  scheduled_for: string | null;
  status: "live";
};

const ALL_FILTER = "all";

const Scholars = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [scholars, setScholars] = useState<ScholarWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [liveLivestreams, setLiveLivestreams] = useState<
    LiveScholarLivestream[]
  >([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState(ALL_FILTER);
  const [languageFilter, setLanguageFilter] = useState(ALL_FILTER);
  const [specialtyFilter, setSpecialtyFilter] = useState(ALL_FILTER);

  useEffect(() => {
    const loadScholars = async () => {
      try {
        setLoading(true);

        const { data: scholarData, error: scholarError } = await supabase
          .from("scholar_profiles")
          .select(
            `
              id,
              user_id,
              display_name,
              biography,
              specialties,
              languages,
              country,
              city,
              is_featured,
              is_active,
              verification_status
            `
          )
          .eq("verification_status", "approved")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("display_name", { ascending: true });

        if (scholarError) {
          throw scholarError;
        }

        const approvedScholars = scholarData ?? [];

        if (approvedScholars.length === 0) {
          setScholars([]);
          return;
        }

        const userIds = approvedScholars.map((scholar) => scholar.user_id);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, avatar_url, username, full_name")
          .in("user_id", userIds);

        if (profileError) {
          throw profileError;
        }

        const profilesByUserId = new Map<string, UserProfile>(
          (profileData ?? []).map((profile) => [profile.user_id, profile])
        );

        const combinedScholars: ScholarWithProfile[] = approvedScholars.map(
          (scholar) => {
            const profile = profilesByUserId.get(scholar.user_id);

            return {
              ...scholar,
              avatar_url: profile?.avatar_url ?? null,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
            };
          }
        );

        setScholars(combinedScholars);
      } catch (error) {
        console.error("Error loading scholars:", error);

        toast({
          title: t("scholars.directory.loadError", {
            defaultValue: "Unable to load scholars",
          }),
          description: t("scholars.directory.loadErrorDescription", {
            defaultValue:
              "The scholar directory could not be loaded. Please try again.",
          }),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadScholars();
  }, [toast, t]);

  useEffect(() => {
    const loadLiveLivestreams = async () => {
      const { data, error } = await supabase
        .from("scholar_livestreams")
        .select(
          `
            id,
            scholar_id,
            title,
            description,
            started_at,
            scheduled_for,
            status
          `
        )
        .eq("status", "live")
        .order("started_at", { ascending: false });

      if (error) {
        console.error("Unable to load live scholar livestreams:", error);
        return;
      }

      setLiveLivestreams((data ?? []) as LiveScholarLivestream[]);
    };

    void loadLiveLivestreams();

    const channel = supabase
      .channel("scholars-live-livestreams")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scholar_livestreams",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;

            if (!deletedId) return;

            setLiveLivestreams((current) =>
              current.filter((livestream) => livestream.id !== deletedId)
            );

            return;
          }

          const updated = payload.new as LiveScholarLivestream & {
            status: "draft" | "upcoming" | "live" | "ended" | "cancelled";
          };

          if (updated.status === "live") {
            setLiveLivestreams((current) => {
              const withoutUpdated = current.filter(
                (livestream) => livestream.id !== updated.id
              );

              return [updated as LiveScholarLivestream, ...withoutUpdated];
            });
          } else {
            setLiveLivestreams((current) =>
              current.filter((livestream) => livestream.id !== updated.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const liveLivestreamByScholarId = useMemo(() => {
    return new Map(
      liveLivestreams.map((livestream) => [livestream.scholar_id, livestream])
    );
  }, [liveLivestreams]);

  const liveScholars = useMemo(() => {
    return liveLivestreams
      .map((livestream) => {
        const scholar = scholars.find(
          (item) => item.id === livestream.scholar_id
        );

        if (!scholar) return null;

        return {
          scholar,
          livestream,
        };
      })
      .filter(
        (
          item
        ): item is {
          scholar: ScholarWithProfile;
          livestream: LiveScholarLivestream;
        } => Boolean(item)
      );
  }, [liveLivestreams, scholars]);

  const countries = useMemo(() => {
    return Array.from(
      new Set(
        scholars
          .map((scholar) => scholar.country)
          .filter((country): country is string => Boolean(country))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [scholars]);

  const languages = useMemo(() => {
    return Array.from(
      new Set(scholars.flatMap((scholar) => scholar.languages ?? []))
    ).sort((a, b) => a.localeCompare(b));
  }, [scholars]);

  const specialties = useMemo(() => {
    return Array.from(
      new Set(scholars.flatMap((scholar) => scholar.specialties ?? []))
    ).sort((a, b) => a.localeCompare(b));
  }, [scholars]);

  const filteredScholars = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return scholars.filter((scholar) => {
      if (liveLivestreamByScholarId.has(scholar.id)) {
        return false;
      }

      const scholarLanguages = scholar.languages ?? [];
      const scholarSpecialties = scholar.specialties ?? [];

      const searchableText = [
        scholar.display_name,
        scholar.full_name,
        scholar.username,
        scholar.biography,
        scholar.city,
        scholar.country,
        ...scholarLanguages,
        ...scholarSpecialties,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = query === "" || searchableText.includes(query);

      const matchesCountry =
        countryFilter === ALL_FILTER || scholar.country === countryFilter;

      const matchesLanguage =
        languageFilter === ALL_FILTER ||
        scholarLanguages.includes(languageFilter);

      const matchesSpecialty =
        specialtyFilter === ALL_FILTER ||
        scholarSpecialties.includes(specialtyFilter);

      return (
        matchesSearch && matchesCountry && matchesLanguage && matchesSpecialty
      );
    });
  }, [
    scholars,
    liveLivestreamByScholarId,
    searchTerm,
    countryFilter,
    languageFilter,
    specialtyFilter,
  ]);

  const clearFilters = () => {
    setSearchTerm("");
    setCountryFilter(ALL_FILTER);
    setLanguageFilter(ALL_FILTER);
    setSpecialtyFilter(ALL_FILTER);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label={t("back", {
              defaultValue: "Back",
            })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {t("scholars.directory.title", {
                defaultValue: "Scholars",
              })}
            </h1>

            <p className="text-sm text-muted-foreground">
              {t("scholars.directory.description", {
                defaultValue:
                  "Discover verified Islamic scholars and their areas of expertise.",
              })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="mb-6 h-auto w-full justify-start gap-4 rounded-xl px-4 py-4 text-left"
          onClick={() => navigate("/scholar/lectures")}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Play className="h-5 w-5 fill-current" />
          </span>

          <span className="min-w-0">
            <span className="block font-semibold">
              {t("scholars.directory.watchLectures", {
                defaultValue: "Watch Scholar Lectures",
              })}
            </span>

            <span className="mt-0.5 block text-sm font-normal text-primary-foreground/80">
              {t("scholars.directory.watchLecturesDescription", {
                defaultValue:
                  "Browse the latest lectures from verified scholars.",
              })}
            </span>
          </span>
        </Button>

        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("scholars.directory.searchPlaceholder", {
                  defaultValue: "Search scholars, specialties or languages",
                })}
                className="pl-9"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("scholars.directory.country", {
                      defaultValue: "Country",
                    })}
                  />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER}>
                    {t("scholars.directory.allCountries", {
                      defaultValue: "All countries",
                    })}
                  </SelectItem>

                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("scholars.directory.language", {
                      defaultValue: "Language",
                    })}
                  />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER}>
                    {t("scholars.directory.allLanguages", {
                      defaultValue: "All languages",
                    })}
                  </SelectItem>

                  {languages.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={specialtyFilter}
                onValueChange={setSpecialtyFilter}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("scholars.directory.specialty", {
                      defaultValue: "Specialty",
                    })}
                  />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER}>
                    {t("scholars.directory.allSpecialties", {
                      defaultValue: "All specialties",
                    })}
                  </SelectItem>

                  {specialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="button" variant="outline" onClick={clearFilters}>
                {t("scholars.directory.clearFilters", {
                  defaultValue: "Clear filters",
                })}
              </Button>
            </div>
          </CardContent>
        </Card>

        {liveScholars.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Radio className="h-5 w-5 animate-pulse text-red-600" />
                  Live Scholars
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Watch scholar lectures happening now.
                </p>
              </div>

              <Badge className="bg-red-600 text-white hover:bg-red-600">
                {liveScholars.length} LIVE
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveScholars.map(({ scholar, livestream }) => (
                <Card
                  key={livestream.id}
                  className="overflow-hidden border-red-500/40"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14">
                          <AvatarImage
                            src={scholar.avatar_url ?? undefined}
                            alt={scholar.display_name}
                          />

                          <AvatarFallback>
                            {getInitials(scholar.display_name)}
                          </AvatarFallback>
                        </Avatar>

                        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background bg-red-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="truncate text-base">
                            {scholar.display_name}
                          </CardTitle>

                          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                        </div>

                        <Badge className="mt-2 bg-red-600 text-white hover:bg-red-600">
                          <Radio className="mr-1 h-3 w-3" />
                          LIVE NOW
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="line-clamp-2 font-semibold">
                        {livestream.title}
                      </h3>

                      {livestream.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {livestream.description}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                      onClick={() =>
                        navigate(
                          `/scholars/${scholar.id}/livestreams/${livestream.id}`
                        )
                      }
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Watch Live
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("scholars.directory.resultCount", {
              count: filteredScholars.length,
              defaultValue:
                filteredScholars.length === 1
                  ? "{{count}} scholar"
                  : "{{count}} scholars",
            })}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardContent className="space-y-4 pt-6">
                  <div className="h-16 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-16 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredScholars.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <UserRound className="mb-4 h-12 w-12 text-muted-foreground" />

              <h2 className="text-lg font-semibold">
                {t("scholars.directory.noResults", {
                  defaultValue: "No scholars found",
                })}
              </h2>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("scholars.directory.noResultsDescription", {
                  defaultValue: "Try changing your search or filters.",
                })}
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={clearFilters}
              >
                {t("scholars.directory.clearFilters", {
                  defaultValue: "Clear filters",
                })}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredScholars.map((scholar) => (
              <Card
                key={scholar.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate(`/scholars/${scholar.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={scholar.avatar_url ?? undefined}
                        alt={scholar.display_name}
                      />

                      <AvatarFallback>
                        {getInitials(scholar.display_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate text-lg">
                          {scholar.display_name}
                        </CardTitle>

                        <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {liveLivestreamByScholarId.has(scholar.id) && (
                          <Badge className="bg-red-600 text-white hover:bg-red-600">
                            <Radio className="mr-1 h-3 w-3" />
                            LIVE
                          </Badge>
                        )}

                        {scholar.is_featured && (
                          <Badge>
                            <Star className="mr-1 h-3 w-3" />
                            {t("scholars.directory.featured", {
                              defaultValue: "Featured",
                            })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {(scholar.city || scholar.country) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />

                      <span>
                        {[scholar.city, scholar.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {scholar.biography && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {scholar.biography}
                    </p>
                  )}

                  {scholar.specialties.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <BookOpen className="h-4 w-4" />
                        {t("scholars.directory.specialties", {
                          defaultValue: "Specialties",
                        })}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {scholar.specialties.slice(0, 3).map((specialty) => (
                          <Badge key={specialty} variant="secondary">
                            {specialty}
                          </Badge>
                        ))}

                        {scholar.specialties.length > 3 && (
                          <Badge variant="outline">
                            +{scholar.specialties.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {scholar.languages.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Languages className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>{scholar.languages.join(", ")}</span>
                    </div>
                  )}

                  {liveLivestreamByScholarId.has(scholar.id) ? (
                    <Button
                      type="button"
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                      onClick={(event) => {
                        event.stopPropagation();

                        const livestream = liveLivestreamByScholarId.get(
                          scholar.id
                        );

                        if (!livestream) return;

                        navigate(
                          `/scholars/${scholar.id}/livestreams/${livestream.id}`
                        );
                      }}
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Watch Live
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/scholars/${scholar.id}`);
                      }}
                    >
                      <Globe2 className="mr-2 h-4 w-4" />
                      {t("scholars.directory.viewScholar", {
                        defaultValue: "View Scholar",
                      })}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scholars;
