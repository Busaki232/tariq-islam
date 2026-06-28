// src/pages/Advertisement.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroButton } from "@/components/ui/hero-button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, Mail, MessageCircle, Eye, Store, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ContactRequestModal } from "@/components/ContactRequestModal";
import { logger } from "@/lib/logger";
import { useTranslation } from "react-i18next";

interface AdvertisementRow {
  id: string;
  title: string;
  description: string;
  location: string | null;
  website: string | null;
  image_url: string | null;
  featured: boolean;
  view_count: number;
  created_at: string;
  category_id: string;
}

interface Advertisement extends AdvertisementRow {
  categories: {
    id?: string;
    name: string;
    slug: string;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  count?: number;
}

const AdvertisementPage = () => {
  const { t } = useTranslation("marketplace");
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [contactModal, setContactModal] = useState<{
    isOpen: boolean;
    advertisementId: string;
    businessName: string;
  }>({
    isOpen: false,
    advertisementId: "",
    businessName: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Optional: keep page title translated
    document.title = t("title");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boot = async () => {
    setLoading(true);
    try {
      const ads = await fetchAdvertisements();
      await fetchCategoriesAndCounts(ads);
    } catch (e) {
      logger.error("unexpected marketplace error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvertisements = async (): Promise<Advertisement[]> => {
    try {
      // Secure RPC: excludes contact info
      const { data, error } = await supabase.rpc("get_public_advertisements");

      if (error) {
        logger.error("Error fetching advertisements", error);
        toast({
          title: t("errors.title", { defaultValue: "Error" }),
          description: t("errors.loadAdsFailed", {
            defaultValue: "Failed to load advertisements. Please refresh the page to try again.",
          }),
          variant: "destructive",
        });
        return [];
      }

      const baseAds = (data || []) as AdvertisementRow[];

      // Attach category data
      const adsWithCategories: Advertisement[] = await Promise.all(
        baseAds.map(async (ad) => {
          const { data: categoryData } = await supabase
            .from("categories")
            .select("id, name, slug")
            .eq("id", ad.category_id)
            .single();

          return {
            ...(ad as AdvertisementRow),
            categories: categoryData || { name: "Uncategorized", slug: "uncategorized" },
          };
        })
      );

      setAdvertisements(adsWithCategories);
      return adsWithCategories;
    } catch (e) {
      logger.error("Error fetching advertisements (catch)", e);
      return [];
    }
  };

  const fetchCategoriesAndCounts = async (ads: Advertisement[]) => {
    try {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) return;

      const list = (data || []) as Category[];

      const countByCategoryId = ads.reduce<Record<string, number>>((acc, ad) => {
        const id = (ad as any).category_id as string | undefined;
        if (!id) return acc;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});

      const categoriesWithCount: Category[] = list.map((c) => ({
        ...c,
        count: countByCategoryId[c.id] || 0,
      }));

      const totalCount = ads.length;

      setCategories([
        { id: "all", name: t("categories.all"), slug: "all", count: totalCount },
        ...categoriesWithCount,
      ]);
    } catch (e) {
      logger.error("Error fetching categories (catch)", e);
    }
  };

  const filteredAds = useMemo(() => {
    if (selectedCategorySlug === "all") return advertisements;
    return advertisements.filter((ad) => ad.categories?.slug === selectedCategorySlug);
  }, [advertisements, selectedCategorySlug]);

  const handlePostBusiness = () => {
    navigate("/submit-ad");
  };

  const handleContactRequest = async (ad: Advertisement) => {
    if (!user) {
      toast({
        title: t("auth.signInRequiredTitle", { defaultValue: "Sign in required" }),
        description: t("auth.signInRequiredBody", { defaultValue: "Please sign in to request contact information." }),
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // We still keep your secure flow (always open the modal)
    try {
      const { error } = await supabase.rpc("get_advertisement_contact_secure", {
        _advertisement_id: ad.id,
      });
      if (error) logger.error("Error checking contact access", error);
    } catch (e) {
      logger.error("Error with secure contact check", e);
    }

    setContactModal({
      isOpen: true,
      advertisementId: ad.id,
      businessName: ad.title,
    });
  };

  const closeContactModal = () => {
    setContactModal({
      isOpen: false,
      advertisementId: "",
      businessName: "",
    });
  };

  const scrollToCategories = () => {
    setSelectedCategorySlug("all");
    const el = document.getElementById("categories-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-background pt-16">
      {/* Header */}
      <section className="bg-gradient-to-br from-secondary/30 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{t("title")}</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">{t("subtitle")}</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user && (
                <HeroButton
                  variant="outline"
                  size="lg"
                  onClick={() => navigate("/my-ads")}
                  className="touch-manipulation active:opacity-70"
                  style={{
                    WebkitTapHighlightColor: "rgba(0,0,0,0)",
                    WebkitTouchCallout: "none",
                  }}
                >
                  <Store className="mr-2" size={20} />
                  {t("actions.myAds")}
                </HeroButton>
              )}

              <HeroButton
                size="lg"
                onClick={handlePostBusiness}
                className="touch-manipulation active:opacity-70"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                }}
              >
                {t("actions.postBusiness")}
              </HeroButton>

              <HeroButton
                variant="outline"
                size="lg"
                onClick={scrollToCategories}
                className="touch-manipulation active:opacity-70"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                }}
              >
                {t("actions.browseCategories")}
              </HeroButton>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories-section" className="py-8 border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((category) => {
              const label = category.slug === "all" ? t("categories.all") : category.name;

              return (
                <Badge
                  key={category.id}
                  variant={selectedCategorySlug === category.slug ? "default" : "secondary"}
                  className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors touch-manipulation active:opacity-70"
                  onClick={() => setSelectedCategorySlug(category.slug)}
                  style={{
                    WebkitTapHighlightColor: "rgba(0,0,0,0)",
                    WebkitTouchCallout: "none",
                    minHeight: "44px",
                  }}
                >
                  {label} ({category.count || 0})
                </Badge>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{t("featured.title")}</h2>
            <p className="text-muted-foreground">{t("featured.subtitle")}</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t("states.loading")}</p>
            </div>
          ) : filteredAds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                {advertisements.length === 0
                  ? t("states.noAds")
                  : selectedCategorySlug === "all"
                    ? t("states.noResults")
                    : t("states.noCategoryResults", {
                        category:
                          categories.find((c) => c.slug === selectedCategorySlug)?.name ||
                          selectedCategorySlug,
                      })}
              </p>

              <HeroButton onClick={handlePostBusiness} className="inline-flex items-center">
                <Mail className="mr-2" size={18} />
                {advertisements.length === 0 ? t("buttons.postFirst") : t("buttons.postBusiness")}
              </HeroButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAds.map((ad) => (
                <Card
                  key={ad.id}
                  className={`shadow-lg hover:shadow-xl transition-shadow ${ad.featured ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="relative">
                    {ad.image_url ? (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-full h-48 object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
                        <span className="text-muted-foreground">{t("card.noImage")}</span>
                      </div>
                    )}

                    {ad.featured && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                        {t("card.featured")}
                      </Badge>
                    )}

                    <Badge variant="secondary" className="absolute top-3 right-3 bg-white/90 text-foreground">
                      {ad.categories?.name}
                    </Badge>
                  </div>

                  <CardHeader>
                    <CardTitle className="text-xl">{ad.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {t("card.views", { count: ad.view_count })}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-3">{ad.description}</p>

                    <div className="space-y-2 mb-4">
                      {ad.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>{ad.location}</span>
                        </div>
                      )}

                      {ad.website && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="w-4 h-4 text-primary" />
                          <a
                            href={ad.website.startsWith("http") ? ad.website : `https://${ad.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline cursor-pointer"
                          >
                            {ad.website}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <HeroButton size="sm" className="flex-1" onClick={() => handleContactRequest(ad)}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {user ? t("buttons.requestContact") : t("buttons.signInToContact")}
                      </HeroButton>

                      {ad.website && (
                        <HeroButton
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            window.open(
                              ad.website?.startsWith("http") ? ad.website : `https://${ad.website}`,
                              "_blank"
                            )
                          }
                        >
                          {t("buttons.website")}
                        </HeroButton>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-secondary/30 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-4">{t("cta.title")}</h2>
            <p className="text-lg text-muted-foreground mb-8">{t("cta.subtitle")}</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <HeroButton
                size="lg"
                onClick={handlePostBusiness}
                className="touch-manipulation active:opacity-70"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                }}
              >
                <Mail className="mr-2" />
                {t("cta.listBusiness")}
              </HeroButton>

              <HeroButton
                variant="outline"
                size="lg"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="touch-manipulation active:opacity-70"
                style={{
                  WebkitTapHighlightColor: "rgba(0,0,0,0)",
                  WebkitTouchCallout: "none",
                }}
              >
                {t("cta.browseMarketplace")}
              </HeroButton>
            </div>

            {/* If you ever need a warning text later, keep it translated like this */}
            {/* <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t("...")}
            </p> */}
          </div>
        </div>
      </section>

      <ContactRequestModal
        isOpen={contactModal.isOpen}
        onClose={closeContactModal}
        advertisementId={contactModal.advertisementId}
        businessName={contactModal.businessName}
      />
    </main>
  );
};

export default AdvertisementPage;