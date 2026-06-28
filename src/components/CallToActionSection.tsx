// src/components/CallToActionSection.tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { HeroButton } from "@/components/ui/hero-button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function CallToActionSection() {
  const { user } = useAuth();
  const { t } = useTranslation("features");

  const title = useMemo(() => {
    return user
      ? t("cta.titleAuthed", "Explore Your Community")
      : t("cta.titleGuest", "Explore Your Community");
  }, [t, user]);

  const heading = useMemo(() => {
    return user
      ? t("cta.card.titleAuthed", "Continue Your Journey")
      : t("cta.card.titleGuest", "Create Your Free Account");
  }, [t, user]);

  const body = useMemo(() => {
    return user
      ? t("cta.card.bodyAuthed", "Access your dashboard and community features")
      : t(
          "cta.card.bodyGuest",
          "Join Tariq Islam and start connecting with Muslims worldwide."
        );
  }, [t, user]);

  const buttonText = useMemo(() => {
    return user
      ? t("cta.card.buttonAuthed", "Go to Dashboard")
      : t("cta.card.buttonGuest", "Join Now - It's Free");
  }, [t, user]);

  const buttonHref = user ? "/dashboard" : "/auth";

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {title}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-3xl mx-auto">
            {t(
              "cta.subtitle",
              "Dive into the full Tariq Islam experience. Connect with your brothers and sisters, track your prayers, and strengthen your faith journey."
            )}
          </p>

          <ul className="mt-8 max-w-3xl mx-auto text-left space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-islamic-gold/20 text-islamic-gold">
                ✓
              </span>
              <span className="text-foreground">
                {t("cta.bullets.worldwide", "Connect with Muslims worldwide")}
              </span>
            </li>

            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-islamic-gold/20 text-islamic-gold">
                ✓
              </span>
              <span className="text-foreground">
                {t(
                  "cta.bullets.events",
                  "Join local and global community events"
                )}
              </span>
            </li>

            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-islamic-gold/20 text-islamic-gold">
                ✓
              </span>
              <span className="text-foreground">
                {t(
                  "cta.bullets.inspire",
                  "Share your faith journey and inspire others"
                )}
              </span>
            </li>

            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-islamic-gold/20 text-islamic-gold">
                ✓
              </span>
              <span className="text-foreground">
                {t(
                  "cta.bullets.tools",
                  "Access exclusive Islamic resources and tools"
                )}
              </span>
            </li>
          </ul>
        </div>

        <Card className="max-w-3xl mx-auto bg-card/60 backdrop-blur-sm border border-white/10">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-islamic-gold text-white">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </div>

            <h3 className="text-2xl md:text-3xl font-bold text-foreground">
              {heading}
            </h3>

            <p className="mt-2 text-muted-foreground">{body}</p>

            <div className="mt-8 flex justify-center">
              <Link to={buttonHref} className="w-full sm:w-auto">
                <HeroButton size="xl" className="w-full sm:w-auto">
                  {buttonText} <span className="ml-2">→</span>
                </HeroButton>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
