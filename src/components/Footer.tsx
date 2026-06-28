// src/components/Footer.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Megaphone, Building2, Mail } from "lucide-react";

import logo from "@/assets/tariq-islam-logo.jpeg";

const Footer = () => {
  const { t, i18n } = useTranslation("common");
  const isRtl = (i18n.resolvedLanguage || i18n.language || "en").startsWith("ar");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt={t("footer.brand.alt", { defaultValue: "Tariq Islam logo" })}
                className="h-12 w-12 rounded-xl object-contain"
              />
              <div>
                <div className="text-lg font-semibold" dir="ltr">
                  {t("footer.brand.name", { defaultValue: "Tariq Islam" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("footer.brand.note", {
                    defaultValue: "Please respect our community",
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">
              {t("footer.columns.community", { defaultValue: "Community" })}
            </div>

            <ul className="space-y-2 text-sm">
              <li>
                <Link className="text-muted-foreground hover:text-foreground" to="/mosques">
                  {t("footer.links.mosques")}
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-foreground" to="/events">
                  {t("footer.links.events")}
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-foreground" to="/chat-room">
                  {t("footer.links.chatRoom")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  to="/community-guidelines"
                >
                  {t("footer.links.communityGuidelines")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  to="/privacy-policy"
                >
                  {t("footer.links.privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  to="/child-safety-policy"
                >
                  {t("footer.links.childSafetyPolicy")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">
              {t("footer.columns.business", { defaultValue: "For Businesses" })}
            </div>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                  to="/advertise"
                >
                  <Megaphone className="h-4 w-4" />
                  {t("footer.links.advertise")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                  to="/business-listings"
                >
                  <Building2 className="h-4 w-4" />
                  {t("footer.links.businessListings")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">
              {t("footer.columns.support", { defaultValue: "Support" })}
            </div>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                  to="/support"
                >
                  <Heart className="h-4 w-4" />
                  {t("footer.links.supportPlatform")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                  to="/contact"
                >
                  <Mail className="h-4 w-4" />
                  {t("footer.links.contactUs")}
                </Link>
              </li>
            </ul>

            <div className={isRtl ? "pt-4 flex justify-end" : "pt-4 flex"}>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                Mobile App Available
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          <span dir="ltr">
            © {year} {t("footer.brand.name", { defaultValue: "Tariq Islam" })}.{" "}
            {t("footer.copyright")}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;