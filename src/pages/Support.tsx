// src/pages/Support.tsx  (or wherever this file lives)
import { Heart, Users, HandHeart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

const Support = () => {
  const { t } = useTranslation("support");

  const tiers = [
    {
      key: "supporter",
      icon: Heart,
      gradient: "from-islamic-green/10 to-islamic-green/5",
      featured: false,
    },
    {
      key: "communityFriend",
      icon: HandHeart,
      gradient: "from-islamic-gold/10 to-islamic-gold/5",
      featured: true,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-islamic-green/10 mb-6">
            <Sparkles className="w-8 h-8 text-islamic-green" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {t("header.title")}
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            {t("header.body.before")}{" "}
            <span className="font-semibold text-islamic-green">
              {t("header.body.free")}
            </span>{" "}
            {t("header.body.after")}
          </p>

          <div className="inline-block bg-card/80 backdrop-blur-sm border border-border rounded-lg px-6 py-3 mt-4">
            <p className="text-sm text-muted-foreground italic">
              {t("header.quote.text")}{" "}
              <span className="font-arabic text-islamic-gold ml-2">
                {t("header.quote.attribution")}
              </span>
            </p>
          </div>
        </div>

        {/* Tiers Section */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const name = t(`tiers.${tier.key}.name`);
            return (
              <Card
                key={tier.key}
                className={`relative overflow-hidden border-2 transition-all hover:shadow-lg hover:scale-105 ${
                  tier.featured ? "border-islamic-gold/30" : "border-border"
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-50`}
                />

                <CardHeader className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        tier.featured
                          ? "bg-islamic-gold/20"
                          : "bg-islamic-green/20"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          tier.featured ? "text-islamic-gold" : "text-islamic-green"
                        }`}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{name}</CardTitle>
                      <CardDescription className="text-base">
                        {t(`tiers.${tier.key}.description`)}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {t(`tiers.${tier.key}.price`)}
                    </span>
                    <span className="text-muted-foreground">
                      /{t(`tiers.${tier.key}.period`)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="relative space-y-6">
                  <ul className="space-y-3">
                    {(t(`tiers.${tier.key}.benefits`, {
                      returnObjects: true,
                    }) as string[]).map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Heart className="w-4 h-4 text-islamic-green mt-1 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={tier.featured ? "default" : "outline"}
                  >
                    {t("tiers.buttonPrefix")} {name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Note */}
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
            <Users className="w-8 h-8 text-islamic-green mx-auto mb-3" />
            <p className="text-muted-foreground font-medium mb-2">
              {t("bottom.optionalTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("bottom.optionalBody")}
            </p>
          </div>

          <p className="text-xs text-muted-foreground italic">
            {t("bottom.footerNote")}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Support;