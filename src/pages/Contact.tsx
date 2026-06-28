// src/pages/Contact.tsx
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactRequestForm } from "@/components/ContactRequestForm";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const navigate = useNavigate();
  const { t } = useTranslation("contact");

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label={t("close")}
              title={t("close")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4">
            <ContactRequestForm />
          </div>
        </div>
      </div>
    </div>
  );
}