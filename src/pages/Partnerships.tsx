// src/pages/Partnerships.tsx
import {
  Building2,
  Users,
  TrendingUp,
  Target,
  CheckCircle2,
  Mail,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const contactSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(10).max(1000),
});

const Partnerships = () => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("partnerships");

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    message: "",
  });

  const pricingTiers = useMemo(
    () => [
      {
        key: "free",
        ctaLink: "/submit-ad",
        popular: false,
      },
      {
        key: "featured",
        ctaLink: "#contact",
        popular: true,
      },
      {
        key: "premium",
        ctaLink: "#contact",
        popular: false,
      },
      {
        key: "enterprise",
        ctaLink: "#contact",
        popular: false,
      },
    ],
    []
  );

  const stats = useMemo(
    () => [
      { key: "activeUsers", icon: Users },
      { key: "monthlyEngagement", icon: TrendingUp },
      { key: "communityEvents", icon: Target },
      { key: "partnerBusinesses", icon: Building2 },
    ],
    []
  );

  // SEO + OG
  useEffect(() => {
    document.title = t("meta.title");

    const setMeta = (name: string, content: string) => {
      const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (el) el.setAttribute("content", content);
      else {
        const m = document.createElement("meta");
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
      }
    };

    const setOg = (property: string, content: string) => {
      const el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (el) el.setAttribute("content", content);
      else {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        m.content = content;
        document.head.appendChild(m);
      }
    };

    setMeta("description", t("meta.description"));
    setMeta("keywords", t("meta.keywords"));
    setOg("og:title", t("meta.ogTitle"));
    setOg("og:description", t("meta.ogDescription"));
  }, [i18n.language, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = contactSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase.from("partnership_inquiries").insert({
        company_name: validated.company_name,
        contact_name: validated.contact_name,
        email: validated.email,
        phone: validated.phone || null,
        message: validated.message,
        inquiry_type: "enterprise",
      });

      if (error) throw error;

      toast({
        title: t("toast.successTitle"),
        description: t("toast.successBody"),
      });

      setFormData({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        message: "",
      });
    } catch (error: any) {
      const isZod = error?.name === "ZodError";
      toast({
        title: isZod ? t("toast.validationTitle") : t("toast.errorTitle"),
        description: isZod ? t("toast.validationBody") : t("toast.errorBody"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {t("hero.title")}
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-gradient-primary shadow-islamic" asChild>
                <a href="#contact">
                  {t("hero.cta.start")} <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>

              <Button size="lg" variant="outline" asChild>
                <a href="#pricing">{t("hero.cta.viewPricing")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.key} className="text-center space-y-2">
                  <Icon className="h-8 w-8 mx-auto text-islamic-green" />
                  <div className="text-3xl font-bold text-foreground">{t(`stats.${stat.key}.value`)}</div>
                  <div className="text-sm text-muted-foreground">{t(`stats.${stat.key}.label`)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Partner Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">{t("why.title")}</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Target className="h-12 w-12 text-islamic-green mb-4" />
                <CardTitle>{t("why.cards.market.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("why.cards.market.body")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CheckCircle2 className="h-12 w-12 text-islamic-green mb-4" />
                <CardTitle>{t("why.cards.trust.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("why.cards.trust.body")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-islamic-green mb-4" />
                <CardTitle>{t("why.cards.roi.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("why.cards.roi.body")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t("pricing.title")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("pricing.subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.key}
                className={tier.popular ? "border-islamic-green shadow-lg relative" : ""}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {t("pricing.mostPopular")}
                  </div>
                )}

                <CardHeader>
                  <CardTitle>{t(`tiers.${tier.key}.name`)}</CardTitle>

                  <div className="mt-4">
                    <span className="text-4xl font-bold">{t(`tiers.${tier.key}.price`)}</span>
                    <span className="text-muted-foreground">{t(`tiers.${tier.key}.period`)}</span>
                  </div>

                  <CardDescription>{t(`tiers.${tier.key}.description`)}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                      const key = `tiers.${tier.key}.features.${i}`;
                      const text = t(key, { defaultValue: "" });
                      if (!text) return null;
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-islamic-green shrink-0 mt-0.5" />
                          <span className="text-sm">{text}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Button
                    className={tier.popular ? "w-full bg-gradient-primary" : "w-full"}
                    variant={tier.popular ? "default" : "outline"}
                    asChild
                  >
                    <a href={tier.ctaLink}>{t(`tiers.${tier.key}.cta`)}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">{t("contact.title")}</CardTitle>
              <CardDescription>{t("contact.subtitle")}</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="company_name" className="text-sm font-medium">
                      {t("contact.form.companyName")} *
                    </label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder={t("contact.form.companyPlaceholder")}
                      required
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="contact_name" className="text-sm font-medium">
                      {t("contact.form.contactName")} *
                    </label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder={t("contact.form.contactPlaceholder")}
                      required
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      {t("contact.form.email")} *
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t("contact.form.emailPlaceholder")}
                      required
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">
                      {t("contact.form.phone")}
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder={t("contact.form.phonePlaceholder")}
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    {t("contact.form.message")} *
                  </label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t("contact.form.messagePlaceholder")}
                    required
                    rows={5}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.message.length}/1000 {t("contact.form.characters")}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-primary shadow-islamic"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? t("contact.form.sending") : t("contact.form.submit")}
                </Button>
              </form>

              <div className="mt-8 pt-8 border-t">
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">{t("contact.direct.label")}</p>

                  <div className="flex flex-wrap justify-center gap-6">
                    <a
                      href="mailto:support@global-muslims-connect.com"
                      className="flex items-center gap-2 text-islamic-green hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      support@global-muslims-connect.com
                    </a>

                    <a
                      href="tel:+13129701766"
                      className="flex items-center gap-2 text-islamic-green hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      +1 (312) 970-1766
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Partnerships;